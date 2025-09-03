import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Camera, AlertTriangle, Eye, Loader2 } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { faceRecognitionService } from '@/utils/faceRecognition';

interface Student {
  id: string;
  name: string;
  student_id: string;
  photo_url?: string;
  face_encoding?: number[];
}

interface Notification {
  id: string;
  student_id: string;
  message: string;
  detected_at: string;
  students: {
    id: string;
    name: string;
    student_id: string;
  };
}

const FaceRecognitionMonitor = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentClassHour, setCurrentClassHour] = useState<string>('');
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchNotifications();
    updateCurrentClassHour();
    initializeFaceRecognition();
    
    // Set up real-time notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications' 
      }, (payload) => {
        fetchNotifications();
      })
      .subscribe();

    const interval = setInterval(updateCurrentClassHour, 60000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  const initializeFaceRecognition = async () => {
    setIsInitializing(true);
    try {
      await faceRecognitionService.initialize();
      console.log('Face recognition service initialized');
    } catch (error) {
      console.error('Failed to initialize face recognition:', error);
      toast({
        title: "Initialization Error",
        description: "Failed to initialize face recognition models",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*');

      if (error) throw error;
      
      // Process the data to handle face_encoding conversion
      const processedStudents = (data || []).map(student => ({
        ...student,
        face_encoding: Array.isArray(student.face_encoding) 
          ? student.face_encoding 
          : student.face_encoding 
            ? JSON.parse(student.face_encoding as string)
            : undefined
      }));
      
      setStudents(processedStudents);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to fetch students",
        variant: "destructive",
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          students (
            id,
            name,
            student_id
          )
        `)
        .eq('date', today)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    }
  };

  const updateCurrentClassHour = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    const schedules = [
      { start: '09:00', end: '10:00', time: '09:00:00', isBreak: false },
      { start: '10:00', end: '10:45', time: '10:00:00', isBreak: false },
      { start: '10:46', end: '10:59', time: '10:46:00', isBreak: true },
      { start: '11:00', end: '12:00', time: '11:00:00', isBreak: false },
      { start: '12:00', end: '12:45', time: '12:00:00', isBreak: false },
      { start: '12:46', end: '13:29', time: '12:46:00', isBreak: true },
      { start: '13:30', end: '14:30', time: '13:30:00', isBreak: false },
      { start: '14:30', end: '15:30', time: '14:30:00', isBreak: false },
      { start: '15:31', end: '15:44', time: '15:31:00', isBreak: true },
      { start: '15:45', end: '16:20', time: '15:45:00', isBreak: false },
    ];

    const currentSchedule = schedules.find(schedule => 
      currentTime >= schedule.start && currentTime <= schedule.end
    );

    if (currentSchedule) {
      setCurrentClassHour(currentSchedule.time);
      setIsBreakTime(currentSchedule.isBreak);
    } else {
      setCurrentClassHour('');
      setIsBreakTime(false);
    }
  };

  const processImageForFaceRecognition = async (imageDataUrl: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      // Load image from data URL
      const imageElement = await faceRecognitionService.loadImageFromDataUrl(imageDataUrl);
      
      // Detect faces in the image
      const detectedFaces = await faceRecognitionService.detectFaces(imageElement);
      
      if (detectedFaces.length === 0) {
        console.log('No faces detected in image');
        return;
      }

      console.log(`Processing ${detectedFaces.length} detected faces`);
      
      // Match detected faces with students
      const matches = await faceRecognitionService.matchFaceWithStudents(
        detectedFaces,
        imageElement,
        students
      );

      console.log(`Found ${matches.length} student matches`);

      // Check attendance and duty leave for matched students
      await checkAttendanceForMatches(matches);
      
    } catch (error) {
      console.error('Error processing image for face recognition:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const checkAttendanceForMatches = async (matches: Array<{ student: Student; confidence: number }>) => {
    if (isBreakTime || !currentClassHour) return;

    const today = new Date().toISOString().split('T')[0];

    for (const match of matches) {
      try {
        // Check if student has attendance record
        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('student_id', match.student.id)
          .eq('date', today)
          .eq('class_hour', currentClassHour);

        // Check if student has duty leave record
        const { data: dutyLeaveData } = await supabase
          .from('duty_leaves')
          .select('*')
          .eq('student_id', match.student.id)
          .eq('date', today)
          .eq('class_hour', currentClassHour);

        // Only create notification if BOTH attendance and duty leave are missing
        if ((!attendanceData || attendanceData.length === 0) && 
            (!dutyLeaveData || dutyLeaveData.length === 0)) {
          
          // Check if notification already exists to avoid duplicates
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('*')
            .eq('student_id', match.student.id)
            .eq('date', today)
            .eq('class_hour', currentClassHour);

          if (!existingNotification || existingNotification.length === 0) {
            await supabase
              .from('notifications')
              .insert({
                student_id: match.student.id,
                message: `${match.student.name} detected without attendance or duty leave (confidence: ${Math.round(match.confidence * 100)}%)`,
                class_hour: currentClassHour,
                date: today,
              });

            console.log(`Alert created for ${match.student.name} - no attendance or duty leave found`);
          }
        } else {
          console.log(`${match.student.name} has valid attendance or duty leave - no alert needed`);
        }
      } catch (error) {
        console.error(`Error checking attendance for ${match.student.name}:`, error);
      }
    }
  };

  const startMonitoring = async () => {
    if (isInitializing) {
      toast({
        title: "Please Wait",
        description: "Face recognition models are still initializing",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsMonitoring(true);
      
      toast({
        title: "Monitoring Started",
        description: "Face recognition monitoring is active",
      });

      // Start continuous monitoring
      monitoringIntervalRef.current = setInterval(async () => {
        if (isBreakTime || !currentClassHour) return;
        
        try {
          // Capture image from camera
          const image = await CapacitorCamera.getPhoto({
            quality: 70,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
          });

          if (image.dataUrl) {
            await processImageForFaceRecognition(image.dataUrl);
          }
        } catch (error) {
          console.error('Error capturing image during monitoring:', error);
        }
      }, 10000); // Check every 10 seconds

    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast({
        title: "Monitoring Error",
        description: "Could not start face recognition monitoring",
        variant: "destructive",
      });
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    toast({
      title: "Monitoring Stopped",
      description: "Face recognition monitoring is inactive",
    });
  };

  const manualCapture = async () => {
    if (isProcessing) return;

    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        await processImageForFaceRecognition(image.dataUrl);
        toast({
          title: "Image Processed",
          description: "Face recognition analysis completed",
        });
      }
    } catch (error) {
      console.error('Error with manual capture:', error);
      toast({
        title: "Capture Error",
        description: "Could not capture or process image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Face Recognition Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Current Status: {currentClassHour ? `Class Hour ${currentClassHour}` : 'No Active Class'}
                </p>
                {isBreakTime && (
                  <Badge variant="secondary" className="mt-1">
                    Break Time - Monitoring Paused
                  </Badge>
                )}
                {isInitializing && (
                  <Badge variant="outline" className="mt-1">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Initializing AI Models
                  </Badge>
                )}
                {isProcessing && (
                  <Badge variant="outline" className="mt-1">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing Image
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={manualCapture} 
                  disabled={!currentClassHour || isBreakTime || isInitializing || isProcessing}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Test Capture
                </Button>
                
                {!isMonitoring ? (
                  <Button 
                    onClick={startMonitoring} 
                    disabled={!currentClassHour || isBreakTime || isInitializing}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Start Monitoring
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopMonitoring}>
                    Stop Monitoring
                  </Button>
                )}
              </div>
            </div>

            {isMonitoring && (
              <div className="text-center p-4 border-2 border-dashed border-primary rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Camera className="h-8 w-8 text-primary" />
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <p className="text-sm font-medium">AI Face Recognition Active</p>
                <p className="text-xs text-muted-foreground">
                  Automatically detecting and matching student faces
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Only alerting for students missing both attendance and duty leave
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Today's Alerts ({notifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No alerts today
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{notification.students.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.detected_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Alert
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceRecognitionMonitor;
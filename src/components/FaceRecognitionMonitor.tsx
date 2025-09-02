import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Camera, AlertTriangle, Eye } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Student {
  id: string;
  name: string;
  student_id: string;
  face_encoding?: any;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchNotifications();
    updateCurrentClassHour();
    
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
    };
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*');

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error fetching students:', error);
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

  const startMonitoring = async () => {
    try {
      // Use Capacitor Camera for mobile
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        // Here you would implement face recognition
        // For now, we'll simulate detection
        await simulateDetection();
      }
      
      setIsMonitoring(true);
      toast({
        title: "Monitoring Started",
        description: "Face recognition monitoring is active",
      });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera",
        variant: "destructive",
      });
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    toast({
      title: "Monitoring Stopped",
      description: "Face recognition monitoring is inactive",
    });
  };

  // Simulate detection for demo purposes
  const simulateDetection = async () => {
    if (isBreakTime) return; // Skip during break time

    // Randomly select a student who might not have attendance/duty leave
    const randomStudent = students[Math.floor(Math.random() * students.length)];
    
    if (randomStudent && currentClassHour) {
      // Check if student has attendance or duty leave for current hour
      const today = new Date().toISOString().split('T')[0];
      
      const { data: attendance } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', randomStudent.id)
        .eq('date', today)
        .eq('class_hour', currentClassHour);

      const { data: dutyLeave } = await supabase
        .from('duty_leaves')
        .select('*')
        .eq('student_id', randomStudent.id)
        .eq('date', today)
        .eq('class_hour', currentClassHour);

      if (!attendance?.length && !dutyLeave?.length) {
        // Student found without attendance or duty leave
        await supabase
          .from('notifications')
          .insert({
            student_id: randomStudent.id,
            message: `${randomStudent.name} detected without attendance or duty leave`,
            class_hour: currentClassHour,
            date: today,
          });
      }
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
              </div>
              
              {!isMonitoring ? (
                <Button onClick={startMonitoring} disabled={!currentClassHour || isBreakTime}>
                  <Camera className="h-4 w-4 mr-2" />
                  Start Monitoring
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopMonitoring}>
                  Stop Monitoring
                </Button>
              )}
            </div>

            {isMonitoring && (
              <div className="text-center p-4 border-2 border-dashed border-primary rounded-lg">
                <Camera className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Camera Monitoring Active</p>
                <p className="text-xs text-muted-foreground">
                  Detecting students without attendance or duty leave
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
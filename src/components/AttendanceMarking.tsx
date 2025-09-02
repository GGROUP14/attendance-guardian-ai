import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  student_id: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: string;
}

interface DutyLeave {
  id: string;
  student_id: string;
  reason?: string;
}

const AttendanceMarking = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentClassHour, setCurrentClassHour] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [dutyLeaves, setDutyLeaves] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    updateCurrentClassHour();
    
    // Update class hour every minute
    const interval = setInterval(updateCurrentClassHour, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('student_id');

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateCurrentClassHour = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    const schedules = [
      { start: '09:00', end: '10:00', time: '09:00:00' },
      { start: '10:00', end: '10:45', time: '10:00:00' },
      { start: '11:00', end: '12:00', time: '11:00:00' },
      { start: '12:00', end: '12:45', time: '12:00:00' },
      { start: '13:30', end: '14:30', time: '13:30:00' },
      { start: '14:30', end: '15:30', time: '14:30:00' },
      { start: '15:45', end: '16:20', time: '15:45:00' },
    ];

    const currentSchedule = schedules.find(schedule => 
      currentTime >= schedule.start && currentTime <= schedule.end
    );

    if (currentSchedule) {
      setCurrentClassHour(currentSchedule.time);
    }
  };

  const markAttendance = (studentId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    
    // If marking present, remove duty leave
    if (status === 'present') {
      setDutyLeaves(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const markDutyLeave = (studentId: string, hasLeave: boolean) => {
    setDutyLeaves(prev => ({ ...prev, [studentId]: hasLeave }));
    
    // If marking duty leave, remove attendance
    if (hasLeave) {
      setAttendance(prev => ({ ...prev, [studentId]: '' }));
    }
  };

  const submitAttendance = async () => {
    if (!currentClassHour) {
      toast({
        title: "Error", 
        description: "No active class hour",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Submit attendance records
      const attendancePromises = Object.entries(attendance).map(([studentId, status]) => {
        if (status) {
          return supabase
            .from('attendance_records')
            .upsert({
              student_id: studentId,
              class_hour: currentClassHour,
              status,
              date: new Date().toISOString().split('T')[0],
            });
        }
      }).filter(Boolean);

      // Submit duty leaves
      const dutyLeavePromises = Object.entries(dutyLeaves).map(([studentId, hasLeave]) => {
        if (hasLeave) {
          return supabase
            .from('duty_leaves')
            .upsert({
              student_id: studentId,
              class_hour: currentClassHour,
              date: new Date().toISOString().split('T')[0],
              reason: 'Duty assigned',
            });
        }
      }).filter(Boolean);

      await Promise.all([...attendancePromises, ...dutyLeavePromises]);

      toast({
        title: "Success",
        description: "Attendance submitted successfully",
      });

      // Reset forms
      setAttendance({});
      setDutyLeaves({});
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentClassHour) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Active Class</h3>
            <p className="text-muted-foreground">
              Attendance marking is only available during class hours
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Mark Attendance - {currentClassHour}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {students.map((student) => (
          <div key={student.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">{student.name}</h4>
                <p className="text-sm text-muted-foreground">{student.student_id}</p>
              </div>
              <div className="flex items-center gap-2">
                {attendance[student.id] === 'present' && (
                  <Badge className="bg-green-500">Present</Badge>
                )}
                {attendance[student.id] === 'absent' && (
                  <Badge variant="destructive">Absent</Badge>
                )}
                {dutyLeaves[student.id] && (
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    Duty Leave
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={attendance[student.id] === 'present' ? 'default' : 'outline'}
                onClick={() => markAttendance(student.id, 'present')}
                disabled={dutyLeaves[student.id]}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Present
              </Button>
              
              <Button
                size="sm"
                variant={attendance[student.id] === 'absent' ? 'destructive' : 'outline'}
                onClick={() => markAttendance(student.id, 'absent')}
                disabled={dutyLeaves[student.id]}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Absent
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              <Button
                size="sm"
                variant={dutyLeaves[student.id] ? 'secondary' : 'outline'}
                onClick={() => markDutyLeave(student.id, !dutyLeaves[student.id])}
                disabled={!!attendance[student.id]}
              >
                <FileText className="h-4 w-4 mr-1" />
                Duty Leave
              </Button>
            </div>
          </div>
        ))}
        
        {students.length > 0 && (
          <Button 
            onClick={submitAttendance} 
            className="w-full"
            disabled={loading || (Object.keys(attendance).length === 0 && Object.keys(dutyLeaves).length === 0)}
          >
            {loading ? 'Submitting...' : 'Submit Attendance'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceMarking;
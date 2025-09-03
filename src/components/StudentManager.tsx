import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Upload, User, Trash2, Plus } from 'lucide-react';
import { faceRecognitionService } from '@/utils/faceRecognition';

interface Student {
  id: string;
  name: string;
  student_id: string;
  photo_url?: string;
  face_encoding?: number[];
}

const StudentManager = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudent, setNewStudent] = useState({ name: '', student_id: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name');

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
    }
  };

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.student_id) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let faceEncoding: number[] | undefined;
      
      // If a photo is provided, create face embedding
      if (selectedFile) {
        await faceRecognitionService.initialize();
        faceEncoding = await faceRecognitionService.createFaceEmbedding(selectedFile);
        
        if (faceEncoding.length === 0) {
          toast({
            title: "Face Detection Failed",
            description: "Could not detect a face in the uploaded image. Student will be added without face recognition.",
            variant: "destructive",
          });
          faceEncoding = undefined;
        }
      }

      const { error } = await supabase
        .from('students')
        .insert({
          name: newStudent.name,
          student_id: newStudent.student_id,
          face_encoding: faceEncoding || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Student ${newStudent.name} added successfully${faceEncoding ? ' with face recognition' : ''}`,
      });

      // Reset form
      setNewStudent({ name: '', student_id: '' });
      setSelectedFile(null);
      fetchStudents();
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete ${studentName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${studentName} has been deleted`,
      });

      fetchStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Student
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Student Name</label>
              <Input
                placeholder="Enter student name"
                value={newStudent.name}
                onChange={(e) => setNewStudent(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Student ID</label>
              <Input
                placeholder="Enter student ID"
                value={newStudent.student_id}
                onChange={(e) => setNewStudent(prev => ({ ...prev, student_id: e.target.value }))}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Photo for Face Recognition (Optional)
            </label>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <Badge variant="secondary">
                  {selectedFile.name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload a clear photo of the student's face for AI recognition
            </p>
          </div>
          
          <Button 
            onClick={addStudent} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Adding Student...' : 'Add Student'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Students ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No students added yet
            </p>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{student.name}</h4>
                      <p className="text-sm text-muted-foreground">{student.student_id}</p>
                      {student.face_encoding && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Face Recognition Enabled
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteStudent(student.id, student.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentManager;
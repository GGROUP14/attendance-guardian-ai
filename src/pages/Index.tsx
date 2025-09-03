import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { LogOut, Users, Camera, ClipboardCheck } from 'lucide-react';
import AttendanceMarking from '@/components/AttendanceMarking';
import FaceRecognitionMonitor from '@/components/FaceRecognitionMonitor';
import StudentManager from '@/components/StudentManager';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile-optimized header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold truncate max-w-[180px] sm:max-w-none sm:text-xl">
              Attendance Guardian
            </h1>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleLogout} className="p-2">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
        
        {/* User info bar */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
      </header>

      {/* Main content with mobile-first tabs */}
      <main className="flex-1 flex flex-col">
        <Tabs defaultValue="attendance" className="flex-1 flex flex-col">
          {/* Mobile-optimized tab navigation */}
          <TabsList className="grid w-full grid-cols-3 bg-transparent h-auto p-0">
            <TabsTrigger 
              value="attendance" 
              className="flex items-center justify-center gap-2 py-4 px-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden xs:inline">Mark</span> Attendance
            </TabsTrigger>
            <TabsTrigger 
              value="monitor" 
              className="flex items-center justify-center gap-2 py-4 px-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden xs:inline">Face</span> Monitor
            </TabsTrigger>
            <TabsTrigger 
              value="students" 
              className="flex items-center justify-center gap-2 py-4 px-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Users className="h-4 w-4" />
              <span className="hidden xs:inline">Manage</span> Students
            </TabsTrigger>
          </TabsList>
          
          {/* Tab content with mobile padding */}
          <div className="flex-1 p-4">
            <TabsContent value="attendance" className="mt-0 h-full">
              <AttendanceMarking />
            </TabsContent>
            
            <TabsContent value="monitor" className="mt-0 h-full">
              <FaceRecognitionMonitor />
            </TabsContent>
            
            <TabsContent value="students" className="mt-0 h-full">
              <StudentManager />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;

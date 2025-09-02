-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  face_encoding JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class schedules table
CREATE TABLE public.class_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break_time BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  class_hour TIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  marked_by UUID REFERENCES auth.users(id),
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date, class_hour)
);

-- Create duty leaves table
CREATE TABLE public.duty_leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  class_hour TIME NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date, class_hour)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  class_hour TIME NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(student_id, date, class_hour)
);

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update students" ON public.students FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view schedules" ON public.class_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage schedules" ON public.class_schedules FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view attendance" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attendance" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update attendance" ON public.attendance_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view duty leaves" ON public.duty_leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert duty leaves" ON public.duty_leaves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update duty leaves" ON public.duty_leaves FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true);

-- Enable realtime for all tables
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.duty_leaves REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Insert default class schedule
INSERT INTO public.class_schedules (start_time, end_time, is_break_time) VALUES
('09:00:00', '10:00:00', false),
('10:00:00', '10:45:00', false),
('10:46:00', '10:59:00', true),
('11:00:00', '12:00:00', false),
('12:00:00', '12:45:00', false),
('12:46:00', '13:29:00', true),
('13:30:00', '14:30:00', false),
('14:30:00', '15:30:00', false),
('15:31:00', '15:44:00', true),
('15:45:00', '16:20:00', false);

-- Insert sample students
INSERT INTO public.students (name, student_id) VALUES
('Student 1', 'S001'),
('Student 2', 'S002'),
('Student 3', 'S003'),
('Student 4', 'S004'),
('Student 5', 'S005'),
('Student 6', 'S006'),
('Student 7', 'S007'),
('Student 8', 'S008'),
('Student 9', 'S009'),
('Student 10', 'S010');
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

interface DetectedFace {
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  score: number;
  embedding?: number[];
}

interface Student {
  id: string;
  name: string;
  student_id: string;
  face_encoding?: number[];
}

class FaceRecognitionService {
  private detector: any = null;
  private embedder: any = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('Initializing face recognition models...');
      
      // Initialize face detection model
      this.detector = await pipeline(
        'object-detection',
        'Xenova/yolos-tiny',
        { device: 'webgpu' }
      );

      // Initialize face embedding model
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { device: 'webgpu' }
      );

      this.initialized = true;
      console.log('Face recognition models initialized successfully');
    } catch (error) {
      console.error('Error initializing face recognition:', error);
      throw error;
    }
  }

  async detectFaces(imageElement: HTMLImageElement): Promise<DetectedFace[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results = await this.detector(imageElement);
      
      // Filter for person detections (faces)
      const faces = results
        .filter((result: any) => result.label === 'person' && result.score > 0.5)
        .map((result: any) => ({
          box: result.box,
          score: result.score
        }));

      console.log(`Detected ${faces.length} faces`);
      return faces;
    } catch (error) {
      console.error('Error detecting faces:', error);
      return [];
    }
  }

  async extractFaceEmbedding(faceImage: HTMLCanvasElement): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert canvas to data URL and then to the format expected by the embedder
      const imageData = faceImage.toDataURL('image/jpeg', 0.8);
      const result = await this.embedder(imageData, { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      return Array.from(result.data);
    } catch (error) {
      console.error('Error extracting face embedding:', error);
      return [];
    }
  }

  cropFaceFromImage(imageElement: HTMLImageElement, faceBox: DetectedFace['box']): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const faceWidth = faceBox.xmax - faceBox.xmin;
    const faceHeight = faceBox.ymax - faceBox.ymin;
    
    canvas.width = faceWidth;
    canvas.height = faceHeight;
    
    ctx.drawImage(
      imageElement,
      faceBox.xmin,
      faceBox.ymin,
      faceWidth,
      faceHeight,
      0,
      0,
      faceWidth,
      faceHeight
    );
    
    return canvas;
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async matchFaceWithStudents(
    detectedFaces: DetectedFace[],
    imageElement: HTMLImageElement,
    students: Student[]
  ): Promise<Array<{ student: Student; confidence: number }>> {
    const matches: Array<{ student: Student; confidence: number }> = [];
    const threshold = 0.7; // Minimum similarity threshold

    for (const face of detectedFaces) {
      try {
        // Crop face from image
        const faceCanvas = this.cropFaceFromImage(imageElement, face.box);
        
        // Extract embedding from detected face
        const faceEmbedding = await this.extractFaceEmbedding(faceCanvas);
        
        if (faceEmbedding.length === 0) continue;

        // Compare with all students
        for (const student of students) {
          if (!student.face_encoding || !Array.isArray(student.face_encoding)) {
            continue;
          }

          const similarity = this.calculateSimilarity(faceEmbedding, student.face_encoding);
          
          if (similarity > threshold) {
            matches.push({
              student,
              confidence: similarity
            });
          }
        }
      } catch (error) {
        console.error('Error processing face:', error);
      }
    }

    // Remove duplicates and keep highest confidence matches
    const uniqueMatches: { [studentId: string]: { student: Student; confidence: number } } = {};
    
    for (const match of matches) {
      const studentId = match.student.id;
      if (!uniqueMatches[studentId] || match.confidence > uniqueMatches[studentId].confidence) {
        uniqueMatches[studentId] = match;
      }
    }

    return Object.values(uniqueMatches);
  }

  async createFaceEmbedding(imageFile: File): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Extract embedding
          const embedding = await this.extractFaceEmbedding(canvas);
          resolve(embedding);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  }

  loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
}

export const faceRecognitionService = new FaceRecognitionService();

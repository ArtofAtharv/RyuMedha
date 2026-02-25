import Dexie, { Table } from 'dexie';

export interface Mutation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  status: 'pending' | 'synced' | 'error';
  createdAt: number;
  error?: string;
}

export class AcademicsDB extends Dexie {
  // Sync Queue
  mutationQueue!: Table<Mutation, number>;
  
  // App Data (Mirroring Prisma)
  users!: Table<any, string>;
  programs!: Table<any, string>;
  semesters!: Table<any, string>;
  subjects!: Table<any, string>;
  tasks!: Table<any, string>;
  grades!: Table<any, string>;
  attendance!: Table<any, string>;

  constructor() {
    super('AcademicsDB');
    
    this.version(2).stores({
      mutationQueue: '++id, status, table', // Outbox pattern
      
      users: 'id, email', 
      programs: 'id',
      semesters: 'id, programId', 
      subjects: 'id, semId, credits', 
      tasks: 'id, subjectId, completed',
      grades: 'id, subjectId',
      attendance: 'id, subjectId, scheduleType'
    });
  }
}

export const db = new AcademicsDB();

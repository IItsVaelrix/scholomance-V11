export type LiteraryDeviceId =
  | 'ALLITERATION'
  | 'ANAPHORA'
  | 'EPISTROPHE'
  | 'ENJAMBMENT'
  | 'REPETITION'
  | 'SIMILE'
  | 'METAPHOR';

export interface LiteraryDevice {
  id: LiteraryDeviceId;
  name: string;
  definition: string;
  count: number;
  examples: string[];
}

export type Emotion =
  | 'Joy'
  | 'Melancholy'
  | 'Rage'
  | 'Defiance'
  | 'Wonder'
  | 'Dread'
  | 'Neutral';

export interface PhonologicalRuleTrace {
  ruleId: string;
  index: number;
  before: string;
  after: string;
}

export interface ApplyProcessOptions {
  trace?: boolean;
}

export interface PhonologicalProcessResult {
  phonemes: string[];
  trace?: PhonologicalRuleTrace[];
}

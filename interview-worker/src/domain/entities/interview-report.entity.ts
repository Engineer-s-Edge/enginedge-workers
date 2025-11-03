export type InterviewScore = {
  overall: number;
  byPhase: {
    behavioral?: number;
    technical?: number;
    coding?: number;
    systemDesign?: number;
  };
};

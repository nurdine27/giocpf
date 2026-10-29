declare const rules: {
  assertLocation(province: string, district: string, provinces: Record<string, string[]>): void;
  assertArea(area: string, areas: string[]): void;
  assertCourseAvailable(course: { published: boolean } | null): void;
  assertEnrollmentOpen(course: { enrollmentOpen: boolean }): void;
  createReference(): string;
  isRegistrationStatus(status: string): boolean;
};
export = rules;

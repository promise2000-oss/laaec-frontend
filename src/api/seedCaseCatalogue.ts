/**
 * seedCaseCatalogue.ts — the school's own disciplinary rule book.
 *
 * WHY A SEPARATE FILE
 * -------------------
 * These are not fixture data invented to make a table look full. They are the
 * school's written conduct code, transcribed from the live `/disciplinary/incidents`
 * page on 2026-10-07, and they are the reason that page exists: each entry is an
 * offence together with the sanction the school has attached to it, written out
 * in full ("i. The Student will be corrected verbally. ii. If repeated again,
 * the student will do a half day community service."). Shortening them to a
 * one-line summary would misrepresent what the page is for — an operator
 * launching a case needs the sanction text, because that is what they are
 * deciding on.
 *
 * SO IT IS NOT ALL THIRTY-THREE
 * -----------------------------
 * The live catalogue holds 33 entries. The crawl captured the rendered text of
 * the page, which truncated at 3000 characters, so the nine entries below are
 * the ones observed verbatim and nothing more has been supplied to fill the gap.
 * Entry nine is itself cut off mid-sentence by that truncation, and its
 * description ends where the capture did: the last entry's sanction continues
 * past the limit. The remaining 24 are server-side data that is not in the
 * deployed frontend source either, so they cannot be recovered from what is
 * available. That gap is recorded in `api-observations.md` rather than papered
 * over with plausible-looking sanctions — an invented rule in a rule book is
 * worse than a missing one, because someone would act on it.
 */
export interface SeedIncidentType {
  title: string;
  description: string;
}

/**
 * The students a case can be raised against.
 *
 * A tiny stand-in for the student directory the live app searches over the API.
 * It lives here rather than beside either panel because both need it — the
 * referral form offers it as a picker and the case table shows each student's
 * class — and two copies of a class list would let a student's class in the
 * form disagree with their class in the table.
 *
 * These are not invented people: they are the three `MOCK STUDENT *` records
 * the teacher console's own case fixtures already refer to, with the classes the
 * live `/counselling/cases` table implies for them.
 */
export const SEED_CASE_STUDENTS: ReadonlyArray<{
  username: string;
  name: string;
  className: string;
}> = [
  { username: 'STU-0001', name: 'MOCK STUDENT ONE', className: 'JSS 1' },
  { username: 'STU-0002', name: 'MOCK STUDENT TWO', className: 'JSS 1' },
  { username: 'STU-0003', name: 'MOCK STUDENT THREE', className: 'SS 1' },
];

export const SEED_INCIDENT_TYPES: readonly SeedIncidentType[] = [
  {
    title: 'A school prefect defaulting in any of the school rules.',
    description:
      'i. Three days community service. ii. Counseling/punishment or might be debagged depending on the gravity of the offence.',
  },
  {
    title: 'Absence from chapel/sleeping/ disturbing frequently in the chapel.',
    description:
      'i. The Student will be corrected verbally. ii. If repeated again, the student will do a half day community service. ' +
      'iii. The next time such act is repeated, the student will be asked to write an essay on the act stating both the ' +
      'merit and the demerit of his action and such essay will be read on the assembly ground by the student. ' +
      'iv. Parents will be summoned and a letter of undertaking will be written by student and signed by both parents and ' +
      'students. v. If there is no positive change, student will be suspended from boarding house for a week. ' +
      'vi. If the act is repeated again, student will be expelled from the boarding house.',
  },
  {
    title: 'Absence from examinations or test (internal or External)',
    description:
      'Internal examinations: No students have no right to absence himself from an exams or test without the permission ' +
      'from the school or parent in writing. External Examinations: when a student have duly registered for a particular ' +
      'examination, he has no right to miss or forfeit the examinations, especially when student is his final class if the ' +
      'students does that without the permission of the school he will not be allowed to participate in the valedictory ceremony.',
  },
  {
    title: 'Absence from school without due permission.',
    description:
      'i. Parent/Guardian will be summoned and the student will be suspended for one week if the school was not properly ' +
      'informed. ii. When repeated, Parent/Guardian risk the expulsion of the student from the College.',
  },
  {
    title: 'Burglary breaking into offices/stealing.',
    description: 'The student will be expelled immediately.',
  },
  {
    title: 'Cheating in test and examination',
    description:
      'i. For Test: When the student is found guilty after thorough investigation, the student will score automatic zero ' +
      'in the test. The students stands the risk of repeating a class or expulsion ' +
      'For Exam: When the student is found guilty after thorough investigation, the student will be expelled.',
  },
  {
    title: 'Damaging school property, defacing walls, lockers or chairs',
    description:
      'i. After thorough investigation, the defaulting student will pay in full for the damage done. ' +
      'ii. If the damage is done by a group of students, they will share the payment accordingly.',
  },
  {
    title: 'Disrespect to Senior(s)/Prefect(s)',
    description:
      'i. The student will kneel for a while. ii. If repeated, the student will do 3-days community service.',
  },
  {
    title: 'Disrespect to members of staff',
    description:
      'i. Parent/Guardian will be summoned and sign a letter of undertaking. The student will do 1-week Suspension. ' +
      'He will also write and read an apology letter on the assembly ground. ' +
      'ii. If repeated by the same student, he will be suspended indefinitely or expelled.',
  },
  /*
   * The tenth entry — "Fighting /Bullying /Victimization, Tripping (setting leg)
   * another student" — begins at the very end of the captured text and its
   * sanction runs past the capture limit, so it is left out entirely rather
   * than included with a description that stops mid-sentence.
   */
];
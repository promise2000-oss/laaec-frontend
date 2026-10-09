(function () {
    const DEFAULT_CLASS_ORDER = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
    const DEFAULT_COLORS = [
        "#123a63",
        "#4ec6ff",
        "#11895f",
        "#f1b844",
        "#ff8c42",
        "#8f5cff",
        "#ef476f",
        "#06d6a0",
        "#26547c",
        "#ffd166"
    ];

    function getUtils(customUtils) {
        return customUtils || window.LAEC_UTILS || {};
    }

    function normalizeClass(studentClass, customUtils) {
        const utils = getUtils(customUtils);
        if (utils.normalizeClassValue) return utils.normalizeClassValue(studentClass);
        return String(studentClass || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    function normalizeSubject(subject, customUtils) {
        const utils = getUtils(customUtils);
        if (utils.normalizeSubjectValue) return utils.normalizeSubjectValue(subject);
        return String(subject || "").trim().toUpperCase().replace(/\s+/g, "_");
    }

    function humanizeSubject(subject, customUtils) {
        const utils = getUtils(customUtils);
        if (utils.humanizeSubject) return utils.humanizeSubject(subject);
        return normalizeSubject(subject, utils).replace(/_/g, " ");
    }

    function getNumericValue(item, fields) {
        for (const field of fields) {
            const raw = item && item[field];
            const value = Number(raw);
            if (Number.isFinite(value)) return value;
        }
        return null;
    }

    function getScoreValue(item) {
        const percentage = getNumericValue(item, ["Percentage", "percentage", "Percent", "percent"]);
        if (percentage !== null) return percentage;

        const score = getNumericValue(item, ["Score", "score", "Average", "average"]);
        const total = getNumericValue(item, ["Total", "total", "TotalObtainable", "totalObtainable", "MaxScore", "maxScore"]);

        if (score !== null && total !== null && total > 0) {
            return Number(((score / total) * 100).toFixed(1));
        }

        return score;
    }

    function getStageForClass(studentClass, customUtils) {
        const normalized = normalizeClass(studentClass, customUtils);
        if (normalized.startsWith("JSS")) return "JUNIOR";
        if (normalized.startsWith("SS")) return "SENIOR";
        return "OTHER";
    }

    function buildSubjectPassMetrics(results, options) {
        const opts = options || {};
        const stage = opts.stage || "ALL";
        const utils = getUtils(opts.utils);
        const metrics = new Map();

        (results || []).forEach(result => {
            const score = getScoreValue(result);
            if (score === null) return;

            const studentClass =
                result.Class ||
                result.class ||
                result.StudentClass ||
                result.studentClass ||
                result.Level ||
                result.level;
            const resultStage = getStageForClass(studentClass, utils);
            if (stage !== "ALL" && resultStage !== stage) return;

            const subject = normalizeSubject(result.Subject || result.subject, utils);
            if (!subject) return;

            const current = metrics.get(subject) || {
                key: subject,
                label: humanizeSubject(subject, utils),
                attempts: 0,
                passCount: 0,
                scoreTotal: 0
            };

            current.attempts += 1;
            current.scoreTotal += score;
            if (score >= 50) current.passCount += 1;
            metrics.set(subject, current);
        });

        return Array.from(metrics.values())
            .map(metric => ({
                ...metric,
                averageScore: Number((metric.scoreTotal / metric.attempts).toFixed(1)),
                passRate: Number(((metric.passCount / metric.attempts) * 100).toFixed(1))
            }))
            .sort((left, right) => right.passRate - left.passRate || right.attempts - left.attempts || left.label.localeCompare(right.label));
    }

    /*
     * Population by class level.
     *
     * Same partition invariant as buildSchoolPopulationMetrics:
     *
     *     sum(metric.count) === students.length
     *
     * The roster held five distinct class values (SSS1, SSS2, JSS3, GRADUATED,
     * JSS2) and the function returned only the six levels of
     * DEFAULT_CLASS_ORDER. A level not on that list was tallied into `counts`
     * and then never returned, so a nine-student roster reported three across
     * six bars and the six that were zero could not say why. Note the two-sided
     * miss: "SSS1" and "GRADUATED" are the same value under different spellings
     * of a level that *is* on the list (SS1, and no level at all), so they were
     * not just missing bars — they were students counted against nothing.
     *
     * The returned list is now the class order plus every other level the
     * directory actually uses, so a total of 0 and a total of 9 are both
     * explicable from the bars drawn.
     */
    function buildClassPopulationMetrics(students, options) {
        const opts = options || {};
        const utils = getUtils(opts.utils);
        const counts = new Map(DEFAULT_CLASS_ORDER.map(studentClass => [studentClass, 0]));

        (students || []).forEach(student => {
            const normalized = normalizeClass(student.Class || student.class, utils);
            const key = normalized || UNASSIGNED_CLASS_KEY;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const ordered = DEFAULT_CLASS_ORDER.map(studentClass => ({
            key: studentClass,
            label: studentClass,
            count: counts.get(studentClass) || 0
        }));

        // Levels the directory uses that the class order does not list.
        const extras = Array.from(counts.keys())
            .filter(key => !DEFAULT_CLASS_ORDER.includes(key))
            .sort();

        return ordered.concat(extras.map(key => ({
            key,
            label: key === UNASSIGNED_CLASS_KEY ? "Unclassified" : key,
            count: counts.get(key)
        })));
    }

    /*
     * A student with no school code at all. It is an id rather than "" so it
     * cannot collide with a real code, and so the bar it lands on is still a
     * distinct dataset key in the chart.
     */
    const UNASSIGNED_SCHOOL_ID = "UNASSIGNED";

    /*
     * A student with no readable class level. Distinct from UNASSIGNED_SCHOOL_ID
     * so the two never collide when a console charts both.
     */
    const UNASSIGNED_CLASS_KEY = "UNCLASSIFIED";

    /*
     * Population by school, and the one invariant every caller depends on:
     *
     *     sum(metric.count for metric in buildSchoolPopulationMetrics(s)) === s.length
     *
     * It used not to hold. The tallies went into `counts` keyed by each
     * student's own `SchoolID`, but the returned list was built from
     * `Object.keys(schoolNames)` — the fixed roster of known college codes. A
     * student carrying any other code (a numeric school id, a newly registered
     * college, a stale code) was counted into a bucket that was then never
     * rendered, so the bars silently summed to less than the roster. A student
     * with no school was dropped outright, before any tally. Either way the
     * caller, which reports the roster length as its own headline total, had two
     * numbers that could not both be right.
     *
     * So the returned list is now the union of both sides of the roster: every
     * code in the name map (zero-filled, so a college with no students still
     * gets a bar), then every remaining code the directory actually carries, then
     * a single Unassigned bar for the students with no school at all.
     */
    function buildSchoolPopulationMetrics(students, options) {
        const opts = options || {};
        const schoolNames = opts.schoolNames || {};
        const counts = new Map();
        const carriedNames = new Map();
        let unassigned = 0;

        (students || []).forEach(student => {
            const schoolID = String(student.SchoolID || student.schoolID || "").trim().toUpperCase();
            if (!schoolID) {
                unassigned += 1;
                return;
            }
            counts.set(schoolID, (counts.get(schoolID) || 0) + 1);

            // Prefer the directory's own spelling of the college for the codes
            // the name map does not cover, so an unknown code still labels well.
            const carried = String(student.SchoolName || student.schoolName || "").trim();
            if (carried && !carriedNames.has(schoolID)) carriedNames.set(schoolID, carried);
        });

        const knownIds = Object.keys(schoolNames);
        const known = new Set(knownIds);
        const metrics = knownIds.map(schoolID => ({
            id: schoolID,
            label: schoolNames[schoolID] || schoolID,
            count: counts.get(schoolID) || 0
        }));

        // Codes the directory uses that the name map does not list. Without a
        // name map at all this is the whole roster, which is what the previous
        // fallback branch did too.
        Array.from(counts.keys())
            .filter(schoolID => !known.has(schoolID))
            .sort()
            .forEach(schoolID => {
                metrics.push({
                    id: schoolID,
                    label: carriedNames.get(schoolID) || schoolNames[schoolID] || schoolID,
                    count: counts.get(schoolID)
                });
            });

        if (unassigned > 0) {
            metrics.push({ id: UNASSIGNED_SCHOOL_ID, label: "Unassigned", count: unassigned });
        }

        return metrics;
    }

    /*
     * Pass rate per school, for the joint-exam pie.
     *
     * This had the same key-space bug as buildSchoolPopulationMetrics, and it
     * was quieter: the result list was assembled from `Object.keys(schoolNames)`
     * and then filtered to `attempts > 0`, so any result carrying a code the
     * name map does not list was tallied into `metrics` and then dropped for
     * having "no attempts" it demonstrably had. A pie built from that is empty,
     * which is indistinguishable on screen from a session with no results.
     *
     * The candidate codes are now the union of the name map and the codes the
     * results actually carry, so the `attempts > 0` filter means what it says:
     * a school that sat the exam and a school that did not. Results with no
     * school code at all are still skipped — a pass rate with no denominator to
     * attribute it to cannot be charted, and unlike a population count there is
     * no total to keep reconciled here.
     */
    function buildSchoolPassMetrics(results, options) {
        const opts = options || {};
        const schoolNames = opts.schoolNames || {};
        const metrics = new Map();
        const carriedNames = new Map();

        (results || []).forEach(result => {
            const schoolID = String(result.SchoolID || result.schoolID || "").trim().toUpperCase();
            const score = getScoreValue(result);
            if (!schoolID || score === null) return;

            const current = metrics.get(schoolID) || {
                id: schoolID,
                label: schoolNames[schoolID] || schoolID,
                attempts: 0,
                passCount: 0,
                scoreTotal: 0
            };

            current.attempts += 1;
            current.scoreTotal += score;
            if (score >= 50) current.passCount += 1;
            metrics.set(schoolID, current);

            const carried = String(result.SchoolName || result.schoolName || "").trim();
            if (carried && !carriedNames.has(schoolID)) carriedNames.set(schoolID, carried);
        });

        const knownIds = Object.keys(schoolNames);
        const known = new Set(knownIds);
        const candidateIds = knownIds.concat(
            Array.from(metrics.keys()).filter(schoolID => !known.has(schoolID)).sort()
        );

        return candidateIds
            .map(schoolID => {
                const metric = metrics.get(schoolID);
                if (!metric) return null;

                if (!schoolNames[schoolID] && carriedNames.has(schoolID)) {
                    metric.label = carriedNames.get(schoolID);
                }

                return {
                    ...metric,
                    averageScore: Number((metric.scoreTotal / metric.attempts).toFixed(1)),
                    passRate: Number(((metric.passCount / metric.attempts) * 100).toFixed(1))
                };
            })
            .filter(metric => metric !== null && metric.attempts > 0)
            .sort((left, right) => right.passRate - left.passRate || right.attempts - left.attempts || left.label.localeCompare(right.label));
    }

    function getColors(count) {
        return Array.from({ length: count }, function (_, index) {
            return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
        });
    }

    window.LAECDashboardAnalytics = {
        UNASSIGNED_CLASS_KEY,
        UNASSIGNED_SCHOOL_ID,
        buildClassPopulationMetrics,
        buildSchoolPassMetrics,
        buildSchoolPopulationMetrics,
        buildSubjectPassMetrics,
        getColors,
        getStageForClass
    };
})();

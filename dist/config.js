const AWS_CONFIG = {
    region: "us-east-1",
    tableName: "Lagos_Education_Commission",
    userPoolId: "us-east-1_K9Rbj2rSw",
    clientId: "1rhsndrfu8gf4pjmfn4rp4q5og",
    registerEndpoint: "https://9gokgv7ftc.execute-api.us-east-1.amazonaws.com/",
    getStudentsEndpoint: "https://179q8swwf6.execute-api.us-east-1.amazonaws.com"
};

const SUBJECT_ALIAS_GROUPS = {
    MATHEMATICS: ["MATHEMATICS", "MATHEMATICS ", "MATHS", "MATH", "MATHEMATIC", "MATHEMATICS/MATHS", "MATHEMATICS AND MATHS"],
    ENGLISH_LANGUAGE: ["ENGLISH_LANGUAGE", "ENGLISH LANGUAGE", "ENGLISH-LANGUAGE", "ENGLISH", "ENG", "ENGLISH LANG", "ENGLISH LANG.", "ENGLISH STUDIES", "ENGLISH_LANGUAGE_STUDIES"],
    CITIZENSHIP_HERITAGE: ["CITIZENSHIP_HERITAGE", "CITIZENSHIP HERITAGE", "CITIZENSHIP & HERITAGE", "CITIZENSHIP AND HERITAGE", "CITIZENSHIP & HERITAGE STUDIES", "CITIZENSHIP AND HERITAGE STUDIES", "CITIZENSHIP_HERITAGE_STUDIES"],
    DIGITAL_TECHNOLOGY: ["DIGITAL_TECHNOLOGY", "DIGITAL TECHNOLOGY", "DIGITAL-TECHNOLOGY", "DIGITAL TECH", "DIGITAL-TECH", "DIGITAL_TECH", "DIGITECH", "DIGITAL TECHNOLOGY ICT", "ICT", "I C T", "INFORMATION COMMUNICATION TECHNOLOGY", "INFORMATION AND COMMUNICATION TECHNOLOGY", "COMPUTER ICT", "DIGITAL TECHNOLOGY (ICT)"],
    NIGERIAN_LANGUAGE: ["NIGERIAN_LANGUAGE", "NIGERIAN LANGUAGE", "NIGERIAN-LANGUAGE", "NIGERIAN LANG", "YORUBA/IGBO/HAUSA", "YORUBA IGBO HAUSA", "YORUBA LANGUAGE/IGBO LANGUAGE", "NIGERIAN LANGUAGE (YORUBA/IGBO/HAUSA)"],
    YORUBA: ["YORUBA", "YORUBA LANGUAGE"],
    INTERMEDIATE_SCIENCE: ["INTERMEDIATE_SCIENCE", "INTERMEDIATE SCIENCE"],
    BASIC_TECH: ["BASIC_TECH", "BASIC TECH", "BASIC-TECH", "BASIC TECHNOLOGY", "BASIC-TECHNOLOGY", "BASIC TECHNOLOGY EDUCATION", "BTE"],
    BUSINESS_STUDIES: ["BUSINESS_STUDIES", "BUSINESS STUDIES"],
    NIGERIAN_HISTORY: ["NIGERIAN_HISTORY", "NIGERIAN HISTORY"],
    HISTORY: ["HISTORY"],
    NATIONAL_VALUES: ["NATIONAL_VALUES", "NATIONAL VALUES", "NVE", "CIVIC EDUCATION AND SOCIAL STUDIES", "CIVIC AND SOCIAL STUDIES"],
    CCA: ["CCA", "CULTURAL & CREATIVE ARTS", "CULTURAL AND CREATIVE ARTS", "CULTURAL CREATIVE ARTS"],
    PHE: ["PHE", "PHYS & HEALTH EDU", "PHYSICAL & HEALTH EDUCATION", "PHYSICAL AND HEALTH EDUCATION", "PHYSICAL HEALTH EDUCATION"],
    PRE_VOCATIONAL_STUDIES: ["PRE_VOCATIONAL_STUDIES", "PRE-VOCATIONAL STUDIES", "PRE VOCATIONAL STUDIES", "PRE-VOCATIONAL STUDIES (AGRIC/HOME EC)"],
    RELIGIOUS_STUDIES: ["RELIGIOUS_STUDIES", "RELIGIOUS STUDIES", "CHRISTIAN RELIGIOUS STUDIES", "CHRISTIAN RELIGIOUS STUDIES (CRS)"],
    FRENCH: ["FRENCH", "FRENCH LANGUAGE"],
    BIOLOGY: ["BIOLOGY"],
    CHEMISTRY: ["CHEMISTRY"],
    PHYSICS: ["PHYSICS"],
    FURTHER_MATHEMATICS: ["FURTHER_MATHEMATICS", "FURTHER MATHEMATICS", "FURTHER MATHS", "FURTHER MATH", "FURTHER MATHEMATICS BUSINESS", "FURTHER MATHEMATICS (BUSINESS)"],
    AGRIC_SCIENCE_SSS: ["AGRIC_SCIENCE_SSS", "AGRIC SCIENCE (SSS)", "AGRIC SCIENCE SSS", "AGRICULTURAL SCIENCE (SSS)"],
    GEOGRAPHY: ["GEOGRAPHY"],
    TECHNICAL_DRAWING: ["TECHNICAL_DRAWING", "TECHNICAL DRAWING"],
    BASIC_ELECTRICITY: ["BASIC_ELECTRICITY", "BASIC ELECTRICITY"],
    FOOD_NUTRITION: ["FOOD_NUTRITION", "FOOD & NUTRITION", "FOOD AND NUTRITION", "FOODS AND NUTRITION"],
    LITERATURE_IN_ENGLISH: ["LITERATURE_IN_ENGLISH", "LITERATURE IN ENGLISH", "LITERATURE", "LIT IN ENGLISH", "ENGLISH LITERATURE"],
    GOVERNMENT: ["GOVERNMENT"],
    VISUAL_ARTS: ["VISUAL_ARTS", "VISUAL ARTS", "VISUAL ART"],
    MUSIC: ["MUSIC"],
    HOME_MANAGEMENT: ["HOME_MANAGEMENT", "HOME MANAGEMENT"],
    CRS: ["CRS", "C R S", "CHRISTIAN RELIGIOUS STUDIES", "CHRISTIAN RELIGIOUS STUDIES (CRS)", "CHRISTIAN RELIGIOUS KNOWLEDGE", "CRK"],
    ECONOMICS: ["ECONOMICS"],
    COMMERCE: ["COMMERCE"],
    FINANCIAL_ACCOUNTING: ["FINANCIAL_ACCOUNTING", "FINANCIAL ACCOUNTING", "ACCOUNTING", "FINANCIAL ACCOUNT"],
    MARKETING: ["MARKETING"],
    OFFICE_PRACTICE: ["OFFICE_PRACTICE", "OFFICE PRACTICE"],
    SOLAR_PV_INSTALLATION: ["SOLAR_PV_INSTALLATION", "SOLAR PV INSTALLATION", "SOLAR PV INSTALLATION & MAINTENANCE"],
    FASHION_DESIGN: ["FASHION_DESIGN", "FASHION DESIGN", "FASHION DESIGN & GARMENT MAKING", "GARMENT MAKING AND FASHION DESIGNING", "GARMENT AND FASHION MAKING"],
    LIVESTOCK_FARMING: ["LIVESTOCK_FARMING", "LIVESTOCK FARMING"],
    BEAUTY_COSMETOLOGY: ["BEAUTY_COSMETOLOGY", "BEAUTY & COSMETOLOGY", "BEAUTY AND COSMETOLOGY"],
    COMPUTER_GSM_REPAIR: ["COMPUTER_GSM_REPAIR", "COMPUTER HARDWARE & GSM REPAIRS", "COMPUTER AND GSM REPAIRS"],
    HORTICULTURE_CROP: ["HORTICULTURE_CROP", "HORTICULTURE", "HORTICULTURE & CROP PRODUCTION", "HORTICULTURE AND CROP PRODUCTION"],
    DATA_PROCESSING: ["DATA_PROCESSING", "DATA PROCESSING"],
    CATERING_CRAFT: ["CATERING_CRAFT", "CATERING CRAFT", "CATERING CRAFT PRACTICE"],
    ANIMAL_HUSBANDRY: ["ANIMAL_HUSBANDRY", "ANIMAL HUSBANDRY"],
    BOOK_KEEPING: ["BOOK_KEEPING", "BOOK-KEEPING", "BOOK KEEPING"],
    PHOTOGRAPHY: ["PHOTOGRAPHY"],
    CIVIC_EDUCATION: ["CIVIC_EDUCATION", "CIVIC EDUCATION", "CIVICS"],
    CIVIC_SECURITY: ["CIVIC_SECURITY", "CIVIC SECURITY", "CIVIC & SECURITY", "CIVIC AND SECURITY", "CIVIC SECURITY STUDIES", "CIVIC & SECURITY STUDIES", "CIVIC AND SECURITY STUDIES"],
    BASIC_SCIENCE: ["BASIC_SCIENCE", "BASIC SCIENCE"],
    BASIC_SCIENCE_TECHNOLOGY: ["BASIC_SCIENCE_TECHNOLOGY", "BASIC SCIENCE TECHNOLOGY", "BASIC-SCIENCE-TECHNOLOGY", "BASIC SCIENCE AND TECHNOLOGY", "BASIC SCIENCE & TECHNOLOGY", "BST", "B S T", "COMPUTER SCIENCE PHE BASIC SCIENCE AND BASIC TECHNOLOGY"],
    SOCIAL_STUDIES: ["SOCIAL_STUDIES", "SOCIAL STUDIES"],
    FINE_ART: ["FINE_ART", "FINE ART", "FINE ARTS", "ART", "ARTS"],
    AGRIC_SCIENCE_JSS: ["AGRIC_SCIENCE_JSS", "AGRIC SCIENCE (JSS)", "AGRIC SCIENCE JSS", "AGRICULTURAL SCIENCE (JSS)"],
    HOME_ECONOMICS: ["HOME_ECONOMICS", "HOME ECONOMICS"],
    COMPUTER_STUDIES: ["COMPUTER_STUDIES", "COMPUTER STUDIES", "COMPUTER"],
    HEALTH_EDUCATION: ["HEALTH_EDUCATION", "HEALTH EDUCATION"],
    GARMENT_MAKING: ["GARMENT_MAKING", "GARMENT MAKING"],
    STORE_MANAGEMENT: ["STORE_MANAGEMENT", "STORE MANAGEMENT"]
};

const CLASS_ALIAS_MAP = {
    JSS1: "JSS1",
    JSS_1: "JSS1",
    JS1: "JSS1",
    JSS2: "JSS2",
    JSS_2: "JSS2",
    JS2: "JSS2",
    JSS3: "JSS3",
    JSS_3: "JSS3",
    JS3: "JSS3",
    SS1: "SS1",
    SS_1: "SS1",
    SSS1: "SS1",
    SSS_1: "SS1",
    SS2: "SS2",
    SS_2: "SS2",
    SSS2: "SS2",
    SSS_2: "SS2",
    SS3: "SS3",
    SS_3: "SS3",
    SSS3: "SS3",
    SSS_3: "SS3"
};

function cleanText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function escapeRawHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeLookupKey(value) {
    return cleanText(value)
        .toUpperCase()
        .replace(/&/g, " AND ")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
}

const SUBJECT_ALIAS_LOOKUP = Object.entries(SUBJECT_ALIAS_GROUPS).reduce((lookup, [canonical, aliases]) => {
    lookup[normalizeLookupKey(canonical)] = canonical;
    aliases.forEach(alias => {
        lookup[normalizeLookupKey(alias)] = canonical;
    });
    return lookup;
}, {});

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

const STANDARD_CLASS_OPTIONS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

const STANDARD_SUBJECT_OPTIONS = uniqueValues([
    ...Object.keys(SUBJECT_ALIAS_GROUPS)
]);

const QUESTION_INVENTORY_CACHE = new Map();

function normalizeSubjectValue(value) {
    const lookupKey = normalizeLookupKey(value);
    return SUBJECT_ALIAS_LOOKUP[lookupKey] || lookupKey;
}

function getSubjectCandidates(value) {
    const canonical = normalizeSubjectValue(value);
    const aliases = SUBJECT_ALIAS_GROUPS[canonical] || [];
    return uniqueValues([
        canonical,
        canonical.replace(/_/g, " "),
        cleanText(value).toUpperCase(),
        ...aliases.map(alias => cleanText(alias).toUpperCase())
    ]);
}

function normalizeClassValue(value) {
    const lookupKey = normalizeLookupKey(value);
    if (CLASS_ALIAS_MAP[lookupKey]) return CLASS_ALIAS_MAP[lookupKey];
    return lookupKey.replace(/_/g, "");
}

function getClassCandidates(value) {
    const canonical = normalizeClassValue(value);
    const match = canonical.match(/^(JSS|SS)(\d)$/);
    return uniqueValues([
        canonical,
        match ? `${match[1]} ${match[2]}` : "",
        cleanText(value).toUpperCase()
    ]);
}

function normalizeQuestionType(value, row) {
    const explicitType = normalizeLookupKey(value);
    if (explicitType === "OBJECTIVE" || explicitType === "SUB_OBJECTIVE" || explicitType === "SUBOBJECTIVE" || explicitType === "THEORY") {
        return explicitType === "SUBOBJECTIVE" ? "SUB_OBJECTIVE" : explicitType;
    }
    const hasOptions = ["A", "B", "C", "D"].some(letter => cleanText(row[letter]) !== "");
    return hasOptions ? "OBJECTIVE" : "THEORY";
}

function normalizeNumericCell(value) {
    const text = cleanText(value);
    if (text === "") return "";
    const num = Number(text);
    return Number.isFinite(num) ? num : text;
}

function escapeHtml(value) {
    return escapeRawHtml(cleanText(value));
}

function sanitizeStyle(styleText) {
    const safeRules = [];
    cleanText(styleText).split(";").forEach(rule => {
        const [rawName, rawValue] = rule.split(":");
        const name = cleanText(rawName).toLowerCase();
        const value = cleanText(rawValue).toLowerCase();
        if (!name || !value) return;

        if (name === "font-weight" && (/^(bold|[6-9]00)$/.test(value))) safeRules.push("font-weight:bold");
        if (name === "font-style" && value === "italic") safeRules.push("font-style:italic");
        if (name === "text-decoration" && value.includes("underline")) safeRules.push("text-decoration:underline");
        if (name === "vertical-align" && (value === "sub" || value === "super")) safeRules.push(`vertical-align:${value}`);
    });
    return safeRules.join(";");
}

function sanitizeRichTextHtml(html, fallbackText = "") {
    const source = cleanText(html);
    if (!source) return escapeHtml(fallbackText);
    if (!/<\/?[a-z][\s\S]*>/i.test(source)) return source.replace(/\r?\n/g, "<br>");

    if (typeof document === "undefined") {
        return source
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
            .replace(/\son\w+="[^"]*"/gi, "")
            .replace(/\son\w+='[^']*'/gi, "");
    }

    const template = document.createElement("template");
    template.innerHTML = source;
    const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "SUP", "SUB", "BR", "SPAN"]);

    function sanitizeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
        if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode("");

        const tag = node.tagName;
        if (!allowedTags.has(tag)) {
            const fragment = document.createDocumentFragment();
            Array.from(node.childNodes).forEach(child => fragment.appendChild(sanitizeNode(child)));
            return fragment;
        }

        const cleanEl = document.createElement(tag.toLowerCase());
        if (tag === "SPAN") {
            const safeStyle = sanitizeStyle(node.getAttribute("style") || "");
            if (safeStyle) cleanEl.setAttribute("style", safeStyle);
        }
        Array.from(node.childNodes).forEach(child => cleanEl.appendChild(sanitizeNode(child)));
        return cleanEl;
    }

    const output = document.createElement("div");
    Array.from(template.content.childNodes).forEach(node => output.appendChild(sanitizeNode(node)));
    return output.innerHTML || escapeHtml(fallbackText);
}

function getExcelCellPlainText(cell) {
    if (!cell) return "";
    return cleanText(cell.w !== undefined ? cell.w : cell.v);
}

function wrapWholeCellStyle(html, cell) {
    const font = cell && cell.s && cell.s.font ? cell.s.font : {};
    let output = html;
    if (font.u) output = `<u>${output}</u>`;
    if (font.i || font.italic) output = `<i>${output}</i>`;
    if (font.b || font.bold) output = `<b>${output}</b>`;
    return output;
}

function getExcelCellHtml(cell) {
    if (!cell) return "";
    const plainText = getExcelCellPlainText(cell);
    const baseHtml = cell.h ? cleanText(cell.h) : escapeHtml(plainText).replace(/\r?\n/g, "<br>");
    return sanitizeRichTextHtml(wrapWholeCellStyle(baseHtml, cell), plainText);
}

function getWorkbookFileText(workbook, path) {
    const files = workbook && workbook.files;
    if (!files) return "";
    const normalizedPath = path.replace(/^\/+/, "");
    const file = files[normalizedPath] || files[`/${normalizedPath}`];
    if (!file) return "";
    const content = file.content || file.data || file;
    if (typeof content === "string") return content;
    if (content instanceof Uint8Array && typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(content);
    if (Array.isArray(content) && typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(new Uint8Array(content));
    if (typeof file.asText === "function") return file.asText();
    return "";
}

function parseXmlDocument(xmlText) {
    if (!xmlText || typeof DOMParser === "undefined") return null;
    return new DOMParser().parseFromString(xmlText, "application/xml");
}

function getNodeText(node) {
    return node ? Array.from(node.getElementsByTagName("t")).map(textNode => textNode.textContent || "").join("") : "";
}

function wrapRichRun(text, runProperties) {
    let output = escapeRawHtml(text).replace(/\r?\n/g, "<br>");
    if (!runProperties) return output;
    const vertAlign = runProperties.getElementsByTagName("vertAlign")[0];
    const vertValue = vertAlign ? cleanText(vertAlign.getAttribute("val")).toLowerCase() : "";
    if (vertValue === "subscript") output = `<sub>${output}</sub>`;
    if (vertValue === "superscript") output = `<sup>${output}</sup>`;
    if (runProperties.getElementsByTagName("u").length) output = `<u>${output}</u>`;
    if (runProperties.getElementsByTagName("i").length) output = `<i>${output}</i>`;
    if (runProperties.getElementsByTagName("b").length) output = `<b>${output}</b>`;
    return output;
}

function parseSharedStringItem(itemNode) {
    const runs = Array.from(itemNode.children || []).filter(child => child.localName === "r");
    if (!runs.length) {
        const text = getNodeText(itemNode);
        return {
            text,
            html: escapeHtml(text).replace(/\r?\n/g, "<br>")
        };
    }

    const parts = runs.map(run => {
        const runProperties = Array.from(run.children || []).find(child => child.localName === "rPr");
        const textNode = Array.from(run.children || []).find(child => child.localName === "t");
        return wrapRichRun(textNode ? textNode.textContent || "" : "", runProperties);
    });

    return {
        text: getNodeText(itemNode),
        html: parts.join("")
    };
}

function parseSharedStrings(workbook) {
    const xml = getWorkbookFileText(workbook, "xl/sharedStrings.xml");
    const doc = parseXmlDocument(xml);
    if (!doc) return [];
    return Array.from(doc.getElementsByTagName("si")).map(parseSharedStringItem);
}

function normalizeWorkbookTarget(target) {
    const cleanTarget = cleanText(target).replace(/^\/+/, "");
    if (!cleanTarget) return "";
    return cleanTarget.startsWith("xl/") ? cleanTarget : `xl/${cleanTarget}`;
}

function getFirstWorksheetPath(workbook) {
    const workbookXml = getWorkbookFileText(workbook, "xl/workbook.xml");
    const relsXml = getWorkbookFileText(workbook, "xl/_rels/workbook.xml.rels");
    const workbookDoc = parseXmlDocument(workbookXml);
    const relsDoc = parseXmlDocument(relsXml);
    const firstSheetName = workbook && workbook.SheetNames ? workbook.SheetNames[0] : "";

    if (workbookDoc && relsDoc) {
        const sheetNode = Array.from(workbookDoc.getElementsByTagName("sheet")).find(sheet => sheet.getAttribute("name") === firstSheetName) || workbookDoc.getElementsByTagName("sheet")[0];
        const relationId = sheetNode ? sheetNode.getAttribute("r:id") || sheetNode.getAttribute("id") : "";
        const relNode = Array.from(relsDoc.getElementsByTagName("Relationship")).find(rel => rel.getAttribute("Id") === relationId);
        const target = relNode ? relNode.getAttribute("Target") : "";
        if (target) return normalizeWorkbookTarget(target);
    }

    const keys = workbook && workbook.keys ? workbook.keys : Object.keys((workbook && workbook.files) || {});
    return keys.find(key => /xl\/worksheets\/sheet\d+\.xml$/i.test(key)) || "xl/worksheets/sheet1.xml";
}

function parseRichWorksheetCells(workbook) {
    const worksheetPath = getFirstWorksheetPath(workbook);
    const worksheetXml = getWorkbookFileText(workbook, worksheetPath);
    const doc = parseXmlDocument(worksheetXml);
    if (!doc) return new Map();

    const sharedStrings = parseSharedStrings(workbook);
    const richCells = new Map();

    Array.from(doc.getElementsByTagName("c")).forEach(cellNode => {
        const address = cellNode.getAttribute("r");
        if (!address) return;

        const type = cellNode.getAttribute("t");
        if (type === "s") {
            const index = Number(cleanText(cellNode.getElementsByTagName("v")[0]?.textContent));
            const richValue = sharedStrings[index];
            if (richValue && richValue.html) richCells.set(address, richValue.html);
            return;
        }

        if (type === "inlineStr") {
            const inlineNode = cellNode.getElementsByTagName("is")[0];
            if (inlineNode) richCells.set(address, parseSharedStringItem(inlineNode).html);
        }
    });

    return richCells;
}

function getQuestionHtmlKey(header) {
    const key = normalizeLookupKey(header);
    if (key === "QUESTION" || key === "TEXT") return `${key === "TEXT" ? "Text" : "Question"}HTML`;
    if (["A", "B", "C", "D"].includes(key)) return `${key}HTML`;
    if (key === "INSTRUCTION" || key === "INSTRUCTIONS" || key === "ASSESSMENTINSTRUCTION") return "AssessmentInstructionHTML";
    return "";
}

function extractFormattedQuestionRows(workbook) {
    if (!workbook || !workbook.Sheets || !workbook.SheetNames || workbook.SheetNames.length === 0) return [];
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet || !sheet["!ref"] || typeof XLSX === "undefined") return [];
    const richCellHtml = parseRichWorksheetCells(workbook);

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const headers = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
        const address = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        headers[col] = getExcelCellPlainText(sheet[address]);
    }

    const rows = [];
    for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex++) {
        const row = {};
        let hasValue = false;

        for (let col = range.s.c; col <= range.e.c; col++) {
            const header = headers[col];
            if (!header) continue;

            const address = XLSX.utils.encode_cell({ r: rowIndex, c: col });
            const cell = sheet[address];
            const value = getExcelCellPlainText(cell);
            row[header] = value;
            if (value) hasValue = true;

            const htmlKey = getQuestionHtmlKey(header);
            if (htmlKey && cell) {
                row[htmlKey] = sanitizeRichTextHtml(richCellHtml.get(address) || getExcelCellHtml(cell), value);
            }
        }

        if (hasValue) rows.push(row);
    }
    return rows;
}

function normalizeQuestionRow(row = {}) {
    const normalized = { ...row };
    const questionText = cleanText(row.Text || row.Question || row.question || row.text);
    const questionHtml = sanitizeRichTextHtml(row.QuestionHTML || row.TextHTML || row.questionHTML || row.textHTML, questionText);

    normalized.Subject = normalizeSubjectValue(row.Subject || row.subject);
    normalized.Term = normalizeLookupKey(row.Term || row.term);
    normalized.Class = normalizeClassValue(row.Class || row.class);
    normalized.QuestionType = normalizeQuestionType(row.QuestionType || row.Type || row.questionType, row);
    normalized.Question = questionText;
    normalized.Text = questionText;
    normalized.QuestionHTML = questionHtml;
    normalized.TextHTML = questionHtml;
    normalized.Correct = cleanText(row.Correct || row.correct || row.Answer || row.answer).toUpperCase();
    normalized.ImageURL = cleanText(
        row.ImageURL ||
        row.ImageUrl ||
        row.imageURL ||
        row.imageUrl ||
        row.Image ||
        row.Diagram ||
        row.DiagramURL
    );

    ["A", "B", "C", "D"].forEach(letter => {
        normalized[letter] = cleanText(row[letter]);
        normalized[`${letter}HTML`] = sanitizeRichTextHtml(row[`${letter}HTML`] || row[`${letter.toLowerCase()}HTML`], normalized[letter]);
    });

    ["CA1", "CA2", "EXAM"].forEach(key => {
        normalized[key] = normalizeNumericCell(row[key]);
    });

    if (normalized.QuestionType === "THEORY") {
        normalized.Correct = "";
    }

    return normalized;
}

function normalizeQuestionRows(rows = []) {
    return rows
        .map(row => normalizeQuestionRow(row))
        .filter(row => row.Subject && row.Class && row.Question);
}

function humanizeSubject(value) {
    const normalized = normalizeSubjectValue(value);
    const labels = {
        BASIC_SCIENCE_TECHNOLOGY: "Basic Science and Technology (BST)",
        BASIC_ELECTRICITY: "Basic Electricity",
        FASHION_DESIGN: "Garment Making and Fashion Designing",
        FOOD_NUTRITION: "Foods and Nutrition",
        HORTICULTURE_CROP: "Horticulture",
        NATIONAL_VALUES: "National Values (NVE)",
        CIVIC_EDUCATION: "Civic Education",
        CIVIC_SECURITY: "Civic & Security Studies",
        RELIGIOUS_STUDIES: "Christian Religious Studies (CRS)",
        CRS: "Christian Religious Studies (CRS)",
        YORUBA: "Yoruba"
    };
    return labels[normalized] || normalized.replace(/_/g, " ");
}

function buildApiUrl(baseUrl, params = {}) {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const url = new URL(base, window.location.href);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchWithRetry(url, options = {}) {
    const {
        retries = 4,
        baseDelayMs = 600,
        maxDelayMs = 6000,
        timeoutMs = 12000,
        retryLabel = "Cloud request",
        fetchImpl = fetch,
        ...fetchOptions
    } = options;

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeout = controller
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;

        try {
            const response = await fetchImpl(url, {
                ...fetchOptions,
                signal: controller ? controller.signal : fetchOptions.signal
            });
            if (!isRetryableStatus(response.status) || attempt === retries) {
                return response;
            }
            lastError = new Error(`${retryLabel} returned ${response.status}`);
        } catch (error) {
            lastError = error;
            if (attempt === retries) throw error;
        } finally {
            if (timeout) clearTimeout(timeout);
        }

        const retryAfterMs = lastError?.response?.headers?.get
            ? Number(lastError.response.headers.get("Retry-After")) * 1000
            : 0;
        const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
        const jitter = Math.floor(Math.random() * 350);
        await sleep((Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : exponentialDelay) + jitter);
    }

    throw lastError || new Error(`${retryLabel} failed`);
}

async function fetchJsonWithRetry(url, options = {}) {
    const response = await fetchWithRetry(url, options);
    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        if (!response.ok) {
            throw new Error(`Cloud request failed with HTTP ${response.status}`);
        }
        throw error;
    }
    if (!response.ok) {
        const error = new Error(data.message || `Cloud request failed with HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function fetchQuestionSet({
    baseUrl,
    params,
    fetchImpl = fetch
}) {
    const subjectCandidates = getSubjectCandidates(params.subject);
    const classCandidates = getClassCandidates(params.class);
    const baseParams = { ...params };
    delete baseParams.subject;
    delete baseParams.class;

    let lastData = { status: "success", questions: [], debug: {} };
    const attempts = [];

    for (const subject of subjectCandidates) {
        for (const studentClass of classCandidates) {
            const url = buildApiUrl(baseUrl, {
                ...baseParams,
                subject,
                class: studentClass
            });

            const data = await fetchJsonWithRetry(url, {
                fetchImpl,
                retryLabel: "Question paper lookup"
            });
            const count = Array.isArray(data.questions) ? data.questions.length : 0;

            attempts.push({
                subject,
                class: studentClass,
                count,
                searchedPK: data.debug && data.debug.searchedPK ? data.debug.searchedPK : ""
            });

            lastData = data;

            if (data.status === "success" && count > 0) {
                return {
                    data: {
                        ...data,
                        questions: normalizeQuestionRows(data.questions),
                        debug: {
                            ...(data.debug || {}),
                            attempts
                        }
                    },
                    attempts,
                    resolvedSubject: subject,
                    resolvedClass: studentClass
                };
            }
        }
    }

    return {
        data: {
            ...lastData,
            questions: [],
            debug: {
                ...(lastData.debug || {}),
                attempts
            }
        },
        attempts,
        resolvedSubject: subjectCandidates[0] || cleanText(params.subject).toUpperCase(),
        resolvedClass: classCandidates[0] || cleanText(params.class).toUpperCase()
    };
}

function summarizeQuestionInventory(questions = []) {
    const inventoryMap = new Map();

    normalizeQuestionRows(questions).forEach(question => {
        const subject = normalizeSubjectValue(question.Subject);
        const studentClass = normalizeClassValue(question.Class);
        const key = `${studentClass}::${subject}`;
        const existing = inventoryMap.get(key) || {
            key,
            Subject: subject,
            Class: studentClass,
            questionCount: 0
        };

        existing.questionCount += 1;
        inventoryMap.set(key, existing);
    });

    return Array.from(inventoryMap.values()).sort((left, right) => {
        const classCompare = STANDARD_CLASS_OPTIONS.indexOf(left.Class) - STANDARD_CLASS_OPTIONS.indexOf(right.Class);
        if (classCompare !== 0) return classCompare;
        return left.Subject.localeCompare(right.Subject);
    });
}

async function fetchQuestionInventory({
    baseUrl,
    schoolID,
    year,
    term,
    type,
    mode,
    fetchImpl = fetch,
    forceRefresh = false
}) {
    const normalizedYear = cleanText(year).replace("/", "-");
    const normalizedTerm = normalizeLookupKey(term);
    const normalizedType = normalizeLookupKey(type);
    const normalizedMode = normalizeLookupKey(mode || "MODE_B") || "MODE_B";
    const normalizedSchool = cleanText(schoolID || "GLOBAL").toUpperCase() || "GLOBAL";
    const cacheKey = JSON.stringify({
        schoolID: normalizedSchool,
        year: normalizedYear,
        term: normalizedTerm,
        type: normalizedType,
        mode: normalizedMode
    });

    if (!forceRefresh && QUESTION_INVENTORY_CACHE.has(cacheKey)) {
        return {
            inventory: QUESTION_INVENTORY_CACHE.get(cacheKey),
            source: "cache"
        };
    }

    const baseParams = {
        action: "GET_SECURE_QUESTIONS",
        schoolID: normalizedSchool,
        year: normalizedYear,
        term: normalizedTerm,
        type: normalizedType,
        mode: normalizedMode
    };

    try {
        const data = await fetchJsonWithRetry(buildApiUrl(baseUrl, {
            action: "GET_QUESTION_INVENTORY",
            schoolID: normalizedSchool,
            year: normalizedYear,
            term: normalizedTerm,
            type: normalizedType,
            mode: normalizedMode
        }), {
            fetchImpl,
            retryLabel: "Question inventory lookup"
        });
        const inventory = Array.isArray(data.inventory) ? data.inventory : [];

        QUESTION_INVENTORY_CACHE.set(cacheKey, inventory);
        return {
            inventory,
            source: data.source || "query"
        };
    } catch (error) {
        // Older deployments may not have the inventory endpoint yet.
    }

    const broadAttempts = [
        baseParams,
        { ...baseParams, subject: "ALL", class: "ALL" },
        { ...baseParams, subject: "ALL_SUBJECTS", class: "ALL_CLASSES" }
    ];

    for (const params of broadAttempts) {
        try {
            const response = await fetchImpl(buildApiUrl(baseUrl, params));
            const data = await response.json();
            const inventory = summarizeQuestionInventory(data.questions || []);

            if (inventory.length > 0) {
                QUESTION_INVENTORY_CACHE.set(cacheKey, inventory);
                return {
                    inventory,
                    source: "broad"
                };
            }
        } catch (error) {
            // Try the next discovery strategy.
        }
    }

    const discoveredInventory = [];
    const taskQueue = [];

    STANDARD_CLASS_OPTIONS.forEach(studentClass => {
        STANDARD_SUBJECT_OPTIONS.forEach(subject => {
            taskQueue.push(async () => {
                try {
                    const response = await fetchImpl(buildApiUrl(baseUrl, {
                        ...baseParams,
                        subject,
                        class: studentClass
                    }));
                    const data = await response.json();
                    const normalizedQuestions = normalizeQuestionRows(data.questions || []);

                    if (normalizedQuestions.length > 0) {
                        discoveredInventory.push({
                            key: `${studentClass}::${subject}`,
                            Subject: subject,
                            Class: studentClass,
                            questionCount: normalizedQuestions.length
                        });
                    }
                } catch (error) {
                    // Ignore single paper lookup failures and continue discovery.
                }
            });
        });
    });

    let queueIndex = 0;

    async function runWorker() {
        while (queueIndex < taskQueue.length) {
            const currentIndex = queueIndex++;
            await taskQueue[currentIndex]();
        }
    }

    await Promise.all(Array.from({ length: 8 }, runWorker));

    const dedupedInventory = Array.from(new Map(
        discoveredInventory.map(item => [item.key, item])
    ).values()).sort((left, right) => {
        const classCompare = STANDARD_CLASS_OPTIONS.indexOf(left.Class) - STANDARD_CLASS_OPTIONS.indexOf(right.Class);
        if (classCompare !== 0) return classCompare;
        return left.Subject.localeCompare(right.Subject);
    });

    QUESTION_INVENTORY_CACHE.set(cacheKey, dedupedInventory);

    return {
        inventory: dedupedInventory,
        source: "scan"
    };
}

if (typeof window !== "undefined") {
    window.AWS_CONFIG = AWS_CONFIG;
    window.LAEC_UTILS = {
        buildApiUrl,
        cleanText,
        fetchJsonWithRetry,
        fetchQuestionSet,
        fetchWithRetry,
        fetchQuestionInventory,
        extractFormattedQuestionRows,
        getClassCandidates,
        getSubjectCandidates,
        humanizeSubject,
        normalizeClassValue,
        normalizeQuestionRow,
        normalizeQuestionRows,
        sanitizeRichTextHtml,
        normalizeSubjectValue,
        STANDARD_CLASS_OPTIONS,
        STANDARD_SUBJECT_OPTIONS,
        summarizeQuestionInventory
    };
}

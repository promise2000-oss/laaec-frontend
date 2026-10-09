(function () {
    const SUBJECT_GROUPS = [
        {
            title: "Core Compulsory Subjects",
            items: [
                { value: "MATHEMATICS", label: "Mathematics" },
                { value: "ENGLISH_LANGUAGE", label: "English Language" },
                { value: "CITIZENSHIP_HERITAGE", label: "Citizenship & Heritage Studies" },
                { value: "DIGITAL_TECHNOLOGY", label: "Digital Technology (ICT)" },
                { value: "CIVIC_EDUCATION", label: "Civic Education" },
                { value: "CRS", label: "Christian Religious Studies (CRS)" },
                { value: "NIGERIAN_LANGUAGE", label: "Nigerian Language (Yoruba/Igbo/Hausa)" }
            ]
        },
        {
            title: "Junior Secondary Subjects (JSS2 & JSS3)",
            items: [
                { value: "FRENCH", label: "French Language" },
                { value: "INTERMEDIATE_SCIENCE", label: "Intermediate Science (B/ Science)" },
                { value: "MUSIC", label: "Music" },
                { value: "FINE_ART", label: "Fine Art" },
                { value: "BASIC_TECH", label: "Basic Tech" },
                { value: "AGRIC_SCIENCE_JSS", label: "Agric" },
                { value: "HOME_ECONOMICS", label: "Home Economics" },
                { value: "CIVIC_SECURITY", label: "Civic & Security Studies" },
                { value: "HISTORY", label: "History" },
                { value: "NATIONAL_VALUES", label: "National Values (NVE)" },
                { value: "PRE_VOCATIONAL_STUDIES", label: "Pre-Vocational Studies (PVS)" },
                { value: "CCA", label: "Creative and Cultural Arts (CCA)" },
                { value: "BASIC_SCIENCE_TECHNOLOGY", label: "Basic Science and Technology (BST)" },
                { value: "BUSINESS_STUDIES", label: "Business Studies" },
                { value: "PHE", label: "Physical Health Education" }
            ]
        },
        {
            title: "Senior Science & Maths",
            items: [
                { value: "BIOLOGY", label: "Biology" },
                { value: "CHEMISTRY", label: "Chemistry" },
                { value: "PHYSICS", label: "Physics" },
                { value: "FURTHER_MATHEMATICS", label: "Further Mathematics" },
                { value: "AGRIC_SCIENCE_SSS", label: "Agricultural Science (SSS)" },
                { value: "PHE", label: "Physical Health Education" },
                { value: "GEOGRAPHY", label: "Geography" },
                { value: "TECHNICAL_DRAWING", label: "Technical Drawing" },
                { value: "BASIC_ELECTRICITY", label: "Basic Electricity" },
                { value: "FOOD_NUTRITION", label: "Foods and Nutrition" }
            ]
        },
        {
            title: "Senior Arts & Humanities",
            items: [
                { value: "LITERATURE_IN_ENGLISH", label: "Literature in English" },
                { value: "GOVERNMENT", label: "Government" },
                { value: "HISTORY", label: "History" },
                { value: "FRENCH", label: "French" },
                { value: "YORUBA", label: "Yoruba" },
                { value: "VISUAL_ARTS", label: "Visual Arts" },
                { value: "MUSIC", label: "Music" },
                { value: "HOME_MANAGEMENT", label: "Home Management" }
            ]
        },
        {
            title: "Senior Commercial",
            items: [
                { value: "ECONOMICS", label: "Economics" },
                { value: "COMMERCE", label: "Commerce" },
                { value: "FINANCIAL_ACCOUNTING", label: "Accounting" },
                { value: "MARKETING", label: "Marketing" },
                { value: "FURTHER_MATHEMATICS", label: "Further Mathematics (Business)" },
                { value: "GOVERNMENT", label: "Government" },
                { value: "OFFICE_PRACTICE", label: "Office Practice" }
            ]
        },
        {
            title: "New Trade & Entrepreneurship",
            items: [
                { value: "SOLAR_PV_INSTALLATION", label: "Solar PV Installation & Maintenance" },
                { value: "FASHION_DESIGN", label: "Garment Making and Fashion Designing" },
                { value: "LIVESTOCK_FARMING", label: "Livestock Farming" },
                { value: "HORTICULTURE_CROP", label: "Horticulture" },
                { value: "BEAUTY_COSMETOLOGY", label: "Beauty & Cosmetology" },
                { value: "COMPUTER_GSM_REPAIR", label: "Computer Hardware & GSM Repairs" },
                { value: "DATA_PROCESSING", label: "Data Processing" },
                { value: "CATERING_CRAFT", label: "Catering Craft Practice" },
                { value: "ANIMAL_HUSBANDRY", label: "Animal Husbandry" },
                { value: "BOOK_KEEPING", label: "Book-Keeping" },
                { value: "PHOTOGRAPHY", label: "Photography" }
            ]
        }
    ];

    let activeState = null;

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>\"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function humanizeSubject(utils, value) {
        if (utils && typeof utils.humanizeSubject === "function") {
            return utils.humanizeSubject(value);
        }
        return String(value || "")
            .toLowerCase()
            .split("_")
            .filter(Boolean)
            .map(function (word) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
    }

    function sanitizeFilenamePart(value, fallback) {
        const cleaned = String(value || fallback || "")
            .trim()
            .replace(/[^\w\s-]+/g, "")
            .replace(/\s+/g, "_");
        return cleaned || fallback || "Student";
    }

    function buildRegistrationFilename(fullName) {
        const nameParts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
        const surname = sanitizeFilenamePart(nameParts[0], "Surname");
        const firstName = sanitizeFilenamePart(nameParts[1] || nameParts[0], "FirstName");
        return firstName + "_" + surname + "_Registration_Slip";
    }

    function getClassOptionsMarkup() {
        return [
            '<option value="">-- Select Class --</option>',
            '<optgroup label="Junior Secondary">',
            '<option value="JSS1">JSS 1</option>',
            '<option value="JSS2">JSS 2</option>',
            '<option value="JSS3">JSS 3</option>',
            "</optgroup>",
            '<optgroup label="Senior Secondary">',
            '<option value="SS1">SS 1</option>',
            '<option value="SS2">SS 2</option>',
            '<option value="SS3">SS 3</option>',
            "</optgroup>"
        ].join("");
    }

    function getArmOptionsMarkup(includeBlank) {
        const options = includeBlank ? ['<option value="">-- Select Arm --</option>'] : ['<option value="ALL">All Arms</option>'];
        for (let code = 65; code <= 90; code += 1) {
            const arm = String.fromCharCode(code);
            options.push('<option value="' + arm + '">' + arm + '</option>');
        }
        return options.join("");
    }

    function getSubjectGroupsMarkup() {
        return SUBJECT_GROUPS.map(function (group) {
            return [
                '<div class="subject-group">',
                '<div class="subject-section-title">' + escapeHtml(group.title) + "</div>",
                '<div class="subject-group-options">',
                group.items.map(function (item) {
                    return [
                        '<label class="subject-option">',
                        '<input type="checkbox" value="' + escapeHtml(item.value) + '">',
                        "<span>" + escapeHtml(item.label) + "</span>",
                        "</label>"
                    ].join("");
                }).join(""),
                "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function getMarkup(config) {
        return [
            '<div class="register-shell">',
            '<div class="control-box register-hero">',
            '<div class="hero-copy">',
            '<div class="section-kicker">Secure Admissions Desk</div>',
            '<h2 style="margin:0">' + escapeHtml(config.title || "Student Registration Portal") + "</h2>",
            "<p>" + escapeHtml(config.subtitle || "Complete student onboarding directly from this dashboard. The school assignment is locked to the active admin identity for cleaner records and safer submissions.") + "</p>",
            '<div class="hero-badges">',
            '<span class="meta-chip">School locked to session</span>',
            '<span class="meta-chip">Camera or image upload</span>',
            '<span class="meta-chip">Printable exam slip</span>',
            "</div>",
            "</div>",
            '<div class="register-lockup">',
            '<div class="register-lockup-label">Active School</div>',
            '<div class="register-lockup-name">' + escapeHtml(config.schoolName) + "</div>",
            '<div class="register-lockup-code">' + escapeHtml(config.schoolId) + "</div>",
            "</div>",
            "</div>",
            '<div class="register-grid">',
            '<div class="card">',
            "<h3>Passport Capture</h3>",
            '<p class="muted-copy">Start the camera to capture a live passport, or choose an existing student image file. Uploaded images are shaped to the same passport size before submission.</p>',
            '<div class="register-camera-frame">',
            '<video id="dashboard-register-video" autoplay playsinline></video>',
            '<img id="dashboard-register-preview" src="" alt="Student preview">',
            '<div class="register-camera-placeholder" id="dashboard-register-placeholder">Camera preview will appear here once capture starts.</div>',
            "</div>",
            '<div class="register-toolbar">',
            '<button type="button" class="btn-soft" id="dashboard-register-start-camera">START CAMERA</button>',
            '<button type="button" class="btn-success" id="dashboard-register-capture" style="display:none;">CAPTURE PHOTO</button>',
            '<label class="btn-soft register-upload-button" for="dashboard-register-photo-file">CHOOSE IMAGE</label>',
            '<input type="file" id="dashboard-register-photo-file" class="register-file-input" accept="image/*">',
            "</div>",
            '<div class="register-camera-source">',
            '<label for="dashboard-register-camera-select">Camera Source</label>',
            '<select id="dashboard-register-camera-select">',
            '<option value="">Default camera</option>',
            "</select>",
            "</div>",
            '<div class="surface-note register-status-list">',
            '<div class="register-status-item"><span>Assigned School</span><strong id="dashboard-register-school-name">' + escapeHtml(config.schoolName) + "</strong></div>",
            '<div class="register-status-item"><span>School Code</span><strong>' + escapeHtml(config.schoolId) + "</strong></div>",
            '<div class="register-status-item"><span>Passport Status</span><strong id="dashboard-register-photo-status">Awaiting capture</strong></div>',
            "</div>",
            "</div>",
            '<div class="card">',
            "<h3>Candidate Bio Data</h3>",
            '<p class="muted-copy">The student will be registered straight into the active school on this dashboard, so the school field is now locked and cannot be changed manually.</p>',
            '<div class="register-form-grid">',
            '<div class="register-span-2">',
            "<label>Assigned School</label>",
            '<input type="text" id="dashboard-register-school-display" class="register-lock-field" readonly value="' + escapeHtml(config.schoolName) + " (" + escapeHtml(config.schoolId) + ')">',
            "</div>",
            '<div class="register-span-2">',
            "<label>Full Name</label>",
            '<input type="text" id="dashboard-register-full-name" placeholder="SURNAME FIRSTNAME OTHERNAME">',
            "</div>",
            '<div class="register-span-2">',
            "<label>Email Address</label>",
            '<input type="email" id="dashboard-register-email" placeholder="student@example.com">',
            '<p class="muted-copy" style="margin:6px 0 0;">Use a dedicated email. An email already used for admin access cannot be used for student registration.</p>',
            "</div>",
            "<div>",
            "<label>Class</label>",
            '<select id="dashboard-register-class">' + getClassOptionsMarkup() + "</select>",
            "</div>",
            "<div>",
            "<label>Arm</label>",
            '<select id="dashboard-register-arm">' + getArmOptionsMarkup(true) + "</select>",
            "</div>",
            "<div>",
            "<label>Registration Channel</label>",
            '<input type="text" class="register-lock-field" readonly value="Dashboard Admin Session">',
            "</div>",
            "</div>",
            '<div class="surface-note">Capture or upload the passport first, complete the bio data, pick all applicable subjects, and the portal will generate a printable examination slip immediately after success.</div>',
            "</div>",
            "</div>",
            '<div class="card">',
            "<h3>Exam Subjects</h3>",
            '<p class="muted-copy">Choose every subject the student should sit for. Use the quick filter to narrow the list while you work.</p>',
            '<div class="register-subject-toolbar">',
            "<div>",
            "<label>Search Subjects</label>",
            '<input type="text" id="dashboard-register-subject-search" placeholder="Type to find subject...">',
            "</div>",
            '<div class="register-subject-count" id="dashboard-register-subject-count">0 Subjects Selected</div>',
            "</div>",
            '<div class="subject-grid" id="dashboard-register-subject-grid">' + getSubjectGroupsMarkup() + "</div>",
            '<div class="register-submit-row">',
            '<button type="button" class="btn-primary register-submit" id="dashboard-register-submit">COMPLETE REGISTRATION</button>',
            "</div>",
            "</div>",
            '<div class="register-slip" id="dashboard-register-slip">',
            '<div class="register-slip-header">',
            "<h2>School Examination Slip</h2>",
            "<p>Powered by NICEGENE TECHNOLOGIES</p>",
            "</div>",
            '<div class="register-slip-body">',
            '<img id="dashboard-register-slip-image" class="register-slip-photo" src="" alt="Student passport">',
            '<div class="register-slip-details">',
            '<p><strong>REG NO:</strong> <span id="dashboard-register-slip-reg"></span></p>',
            '<p><strong>NAME:</strong> <span id="dashboard-register-slip-name"></span></p>',
            '<p><strong>SCHOOL:</strong> <span id="dashboard-register-slip-school"></span></p>',
            '<p><strong>CLASS:</strong> <span id="dashboard-register-slip-class"></span></p>',
            '<p><strong>PASSWORD:</strong> <span id="dashboard-register-slip-pass"></span></p>',
            "</div>",
            "</div>",
            '<div class="register-slip-subjects">',
            "<strong>REGISTERED SUBJECTS:</strong>",
            '<p id="dashboard-register-slip-subjects" style="margin:0.55rem 0 0;"></p>',
            "</div>",
            "</div>",
            '<canvas id="dashboard-register-canvas" style="display:none;"></canvas>',
            "</div>"
        ].join("");
    }

    function showLoading(state, message) {
        if (typeof state.onShowLoading === "function") {
            state.onShowLoading(message);
        }
    }

    function hideLoading(state) {
        if (typeof state.onHideLoading === "function") {
            state.onHideLoading();
        }
    }

    function alertUser(state, title, message) {
        if (typeof state.onAlert === "function") {
            state.onAlert(title, message);
        }
    }

    function query(state, selector) {
        return state.root.querySelector(selector);
    }

    function stopCamera(state) {
        if (!state) {
            return;
        }

        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(function (track) {
                track.stop();
            });
            state.cameraStream = null;
        }

        const video = query(state, "#dashboard-register-video");
        const placeholder = query(state, "#dashboard-register-placeholder");

        if (video) {
            video.srcObject = null;
            if (!state.photoData) {
                video.style.display = "none";
            }
        }

        if (!state.photoData && placeholder) {
            placeholder.style.display = "flex";
        }
    }

    function setPhotoStatus(state, message) {
        const status = query(state, "#dashboard-register-photo-status");
        if (status) {
            status.textContent = message;
        }
    }

    async function refreshCameraDevices(state) {
        const selector = query(state, "#dashboard-register-camera-select");
        if (!selector || !(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)) {
            return;
        }

        try {
            const previousValue = selector.value || state.selectedCameraId || "";
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(function (device) {
                return device.kind === "videoinput";
            });

            state.cameraDevices = cameras;
            selector.innerHTML = '<option value="">Default camera</option>';

            cameras.forEach(function (camera, index) {
                const option = document.createElement("option");
                option.value = camera.deviceId;
                option.textContent = camera.label || "Camera " + (index + 1);
                selector.appendChild(option);
            });

            if (previousValue && cameras.some(function (camera) { return camera.deviceId === previousValue; })) {
                selector.value = previousValue;
                state.selectedCameraId = previousValue;
            } else {
                selector.value = "";
                state.selectedCameraId = "";
            }
        } catch (error) {
            setPhotoStatus(state, "Camera list unavailable");
        }
    }

    function updateSelectedCount(state) {
        const checked = state.root.querySelectorAll('#dashboard-register-subject-grid input[type="checkbox"]:checked').length;
        const counter = query(state, "#dashboard-register-subject-count");
        if (counter) {
            counter.textContent = checked + " Subject" + (checked === 1 ? "" : "s") + " Selected";
        }
    }

    function filterSubjects(state) {
        const searchValue = (query(state, "#dashboard-register-subject-search").value || "").trim().toLowerCase();
        state.root.querySelectorAll(".subject-group").forEach(function (group) {
            let visibleItems = 0;
            group.querySelectorAll(".subject-option").forEach(function (option) {
                const isVisible = option.textContent.toLowerCase().indexOf(searchValue) > -1;
                option.style.display = isVisible ? "flex" : "none";
                if (isVisible) {
                    visibleItems += 1;
                }
            });
            group.style.display = visibleItems > 0 ? "grid" : "none";
        });
    }

    function resetForm(state) {
        state.photoData = null;
        stopCamera(state);

        const preview = query(state, "#dashboard-register-preview");
        const video = query(state, "#dashboard-register-video");
        const placeholder = query(state, "#dashboard-register-placeholder");
        const captureButton = query(state, "#dashboard-register-capture");
        const photoFile = query(state, "#dashboard-register-photo-file");

        query(state, "#dashboard-register-full-name").value = "";
        query(state, "#dashboard-register-email").value = "";
        query(state, "#dashboard-register-class").value = "";
        query(state, "#dashboard-register-subject-search").value = "";
        if (photoFile) {
            photoFile.value = "";
        }

        state.root.querySelectorAll('#dashboard-register-subject-grid input[type="checkbox"]').forEach(function (input) {
            input.checked = false;
        });

        if (preview) {
            preview.src = "";
            preview.style.display = "none";
        }

        if (video) {
            video.style.display = "none";
        }

        if (placeholder) {
            placeholder.style.display = "flex";
        }

        if (captureButton) {
            captureButton.style.display = "none";
            captureButton.textContent = "CAPTURE PHOTO";
            captureButton.className = "btn-success";
        }

        setPhotoStatus(state, "Awaiting capture");
        filterSubjects(state);
        updateSelectedCount(state);
    }

    async function startCamera(state) {
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            alertUser(state, "Camera Error", "Camera access is not supported in this browser.");
            return;
        }

        try {
            stopCamera(state);

            const cameraSelector = query(state, "#dashboard-register-camera-select");
            const selectedCameraId = cameraSelector ? cameraSelector.value : "";
            state.selectedCameraId = selectedCameraId;

            const videoConstraints = selectedCameraId
                ? { deviceId: { exact: selectedCameraId } }
                : true;
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            state.cameraStream = stream;
            state.photoData = null;

            const video = query(state, "#dashboard-register-video");
            const preview = query(state, "#dashboard-register-preview");
            const placeholder = query(state, "#dashboard-register-placeholder");
            const captureButton = query(state, "#dashboard-register-capture");

            video.srcObject = stream;
            video.style.display = "block";
            preview.style.display = "none";
            placeholder.style.display = "none";
            captureButton.style.display = "block";
            captureButton.textContent = "CAPTURE PHOTO";
            captureButton.className = "btn-success";
            await refreshCameraDevices(state);
            const refreshedSelector = query(state, "#dashboard-register-camera-select");
            const activeCameraLabel = refreshedSelector && refreshedSelector.selectedOptions.length
                ? refreshedSelector.selectedOptions[0].textContent
                : "";
            setPhotoStatus(state, activeCameraLabel ? "Camera live: " + activeCameraLabel : "Camera live");
        } catch (error) {
            alertUser(state, "Camera Error", "Unable to access the selected camera. Please allow camera permission, choose another camera source, and try again.");
        }
    }

    function applyPhotoData(state, photoData, statusMessage) {
        const preview = query(state, "#dashboard-register-preview");
        const video = query(state, "#dashboard-register-video");
        const placeholder = query(state, "#dashboard-register-placeholder");
        const captureButton = query(state, "#dashboard-register-capture");

        state.photoData = photoData;
        preview.src = state.photoData;
        preview.style.display = "block";
        video.style.display = "none";
        placeholder.style.display = "none";

        if (captureButton) {
            captureButton.style.display = "block";
            captureButton.textContent = "RETAKE PHOTO";
            captureButton.className = "btn-danger";
        }

        setPhotoStatus(state, statusMessage || "Passport ready");
    }

    function drawImageToPassportCanvas(state, image) {
        const canvas = query(state, "#dashboard-register-canvas");
        const context = canvas.getContext("2d");
        const targetSize = 300;
        const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
        const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
        const sourceSize = Math.min(sourceWidth, sourceHeight);
        const sourceX = (sourceWidth - sourceSize) / 2;
        const sourceY = (sourceHeight - sourceSize) / 2;

        canvas.width = targetSize;
        canvas.height = targetSize;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, targetSize, targetSize);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize);
        return canvas.toDataURL("image/jpeg", 0.92);
    }

    function loadPhotoFile(state, file) {
        if (!file) {
            return;
        }

        if (!/^image\//i.test(file.type || "")) {
            alertUser(state, "Invalid File", "Please choose a valid image file for the student passport.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const image = new Image();
            image.onload = function () {
                stopCamera(state);
                applyPhotoData(state, drawImageToPassportCanvas(state, image), "Passport uploaded");
            };
            image.onerror = function () {
                alertUser(state, "Image Error", "Unable to read this image. Please choose another passport file.");
            };
            image.src = event.target.result;
        };
        reader.onerror = function () {
            alertUser(state, "Image Error", "Unable to open this image file. Please try again.");
        };
        reader.readAsDataURL(file);
    }

    function capturePhoto(state) {
        if (state.photoData) {
            startCamera(state);
            return;
        }

        const video = query(state, "#dashboard-register-video");
        const captureButton = query(state, "#dashboard-register-capture");

        if (!video || !state.cameraStream) {
            alertUser(state, "Camera Error", "Start the camera before attempting to capture a photo.");
            return;
        }

        applyPhotoData(state, drawImageToPassportCanvas(state, video), "Passport captured");
        stopCamera(state);

        captureButton.textContent = "RETAKE PHOTO";
        captureButton.className = "btn-danger";
    }

    function getSelectedSubjects(state) {
        return Array.from(new Set(Array.from(state.root.querySelectorAll('#dashboard-register-subject-grid input[type="checkbox"]:checked')).map(function (input) {
            return input.value;
        })));
    }

    function populateSlip(state, details) {
        query(state, "#dashboard-register-slip-image").src = state.photoData;
        query(state, "#dashboard-register-slip-reg").textContent = details.regNo;
        query(state, "#dashboard-register-slip-name").textContent = details.fullName.toUpperCase();
        query(state, "#dashboard-register-slip-school").textContent = state.schoolName;
        query(state, "#dashboard-register-slip-class").textContent = details.studentClass + (details.studentArm ? " " + details.studentArm : "");
        query(state, "#dashboard-register-slip-pass").textContent = details.password;
        query(state, "#dashboard-register-slip-subjects").textContent = details.subjects.map(function (subject) {
            return humanizeSubject(state.utils, subject);
        }).join(", ");
    }

    function finalizePrint() {
        if (!activeState || !activeState.printPending) {
            return;
        }

        activeState.printPending = false;
        if (activeState.previousDocumentTitle) {
            document.title = activeState.previousDocumentTitle;
            activeState.previousDocumentTitle = "";
        }
        document.body.classList.remove("printing-registration-slip");
        resetForm(activeState);

        if (typeof activeState.onRefresh === "function") {
            activeState.onRefresh();
        }
    }

    async function submitRegistration(state) {
        const fullName = query(state, "#dashboard-register-full-name").value.trim();
        const email = query(state, "#dashboard-register-email").value.trim();
        const studentClass = query(state, "#dashboard-register-class").value;
        const studentArm = query(state, "#dashboard-register-arm").value;
        const selectedSubjects = getSelectedSubjects(state);

        if (!state.schoolId || !fullName || !email || !studentClass || !studentArm || !state.photoData || selectedSubjects.length === 0) {
            alertUser(state, "Incomplete Data", "Capture the passport, fill every field, choose the class and arm, and select at least one subject.");
            return;
        }

        showLoading(state, "Processing secure registration...");

        try {
            const response = await fetch(state.registerEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    schoolID: state.schoolId,
                    fullName: fullName,
                    email: email,
                    studentClass: studentClass,
                    studentArm: studentArm,
                    subjects: selectedSubjects,
                    photoBase64: state.photoData
                })
            });

            const result = await response.json().catch(function () {
                return {};
            });

            if (!response.ok) {
                throw new Error(result.error || result.message || "Registration failed.");
            }

            populateSlip(state, {
                fullName: fullName,
                studentClass: studentClass,
                studentArm: studentArm,
                subjects: selectedSubjects,
                regNo: result.regNo || result.regID || "PENDING",
                password: result.password || "SEE EMAIL"
            });

            hideLoading(state);

            state.printPending = true;
            state.previousDocumentTitle = document.title;
            document.title = buildRegistrationFilename(fullName);
            document.body.classList.add("printing-registration-slip");
            window.requestAnimationFrame(function () {
                setTimeout(function () {
                    window.print();
                }, 100);
            });
        } catch (error) {
            hideLoading(state);
            alertUser(state, "Cloud Error", error.message || "Registration failed. Please retry.");
        }
    }

    function bindEvents(state) {
        query(state, "#dashboard-register-start-camera").addEventListener("click", function () {
            startCamera(state);
        });

        query(state, "#dashboard-register-capture").addEventListener("click", function () {
            capturePhoto(state);
        });

        query(state, "#dashboard-register-photo-file").addEventListener("change", function (event) {
            loadPhotoFile(state, event.target.files && event.target.files[0]);
            event.target.value = "";
        });

        query(state, "#dashboard-register-camera-select").addEventListener("change", function (event) {
            state.selectedCameraId = event.target.value;
            if (state.cameraStream) {
                startCamera(state);
            }
        });

        query(state, "#dashboard-register-submit").addEventListener("click", function () {
            submitRegistration(state);
        });

        query(state, "#dashboard-register-subject-search").addEventListener("input", function () {
            filterSubjects(state);
        });

        query(state, "#dashboard-register-subject-grid").addEventListener("change", function () {
            updateSelectedCount(state);
        });
    }

    function init(config) {
        if (!config || !config.rootId) {
            return;
        }

        const root = document.getElementById(config.rootId);
        if (!root) {
            return;
        }

        if (activeState) {
            stopCamera(activeState);
        }

        root.innerHTML = getMarkup(config);

        activeState = {
            root: root,
            registerEndpoint: config.registerEndpoint,
            schoolId: config.schoolId,
            schoolName: config.schoolName,
            onAlert: config.onAlert,
            onShowLoading: config.onShowLoading,
            onHideLoading: config.onHideLoading,
            onRefresh: config.onRefresh,
            utils: config.utils || null,
            cameraStream: null,
            cameraDevices: [],
            selectedCameraId: "",
            photoData: null,
            printPending: false,
            previousDocumentTitle: ""
        };

        bindEvents(activeState);
        resetForm(activeState);
        refreshCameraDevices(activeState);
    }

    window.addEventListener("afterprint", finalizePrint);
    window.addEventListener("beforeunload", function () {
        if (activeState) {
            stopCamera(activeState);
        }
    });
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
        navigator.mediaDevices.addEventListener("devicechange", function () {
            if (activeState) {
                refreshCameraDevices(activeState);
            }
        });
    }

    window.LAECRegistration = {
        init: init,
        stopCamera: function () {
            if (activeState) {
                stopCamera(activeState);
            }
        }
    };
})();

// Cyber Forensic & Investigation Portal - App Bindings
// Implements the frontend logic for Case Intake, Legal Gates, SMTP Send, IMAP Poll, Visualizations, and AI Summaries.

class CFAAApp {
    constructor() {
        this.activeCaseId = "";
        this.cases = [];
        this.activeDraft = null;
        this.settings = null;
        this.charts = {};
        
        // Bind event listeners
        document.addEventListener("DOMContentLoaded", () => this.init());
    }

    async init() {
        // Initialize Clock
        this.startClock();
        
        // Navigation Tab Bindings
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const targetTab = btn.getAttribute("data-tab");
                this.switchTab(targetTab);
            });
        });

        // Initialize Lucide Icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Form Submissions
        document.getElementById("case-intake-form").addEventListener("submit", (e) => this.handleCaseCreate(e));
        document.getElementById("add-target-form").addEventListener("submit", (e) => this.handleTargetAdd(e));
        document.getElementById("notice-intake-form").addEventListener("submit", (e) => this.handleNoticeGenerate(e));
        document.getElementById("settings-profile-form").addEventListener("submit", (e) => this.handleSettingsSave(e, "profile"));
        document.getElementById("settings-smtp-form").addEventListener("submit", (e) => this.handleSettingsSave(e, "smtp"));
        
        // Legal Checkbox Listeners
        const legalCheckboxes = ["legal-check-authority", "legal-check-approvals", "legal-check-proportionate"];
        legalCheckboxes.forEach(id => {
            document.getElementById(id).addEventListener("change", () => this.verifyLegalValidationGate());
        });

        // Global Case Selector
        document.getElementById("global-case-selector").addEventListener("change", (e) => {
            this.setActiveCase(e.target.value);
        });

        // Drag & Drop Evidence Zone
        this.initDragAndDrop();

        // Chart Data Selector
        document.getElementById("forensics-chart-source").addEventListener("change", (e) => {
            this.loadForensicsCharts(e.target.value);
        });

        // Load initial settings and cases
        await this.loadSettings();
        await this.loadCases();
        this.switchTab("dashboard-tab");
    }

    // ----------------- SYSTEM CLOCK & NAVIGATION -----------------

    startClock() {
        const clockEl = document.getElementById("clock-display");
        const updateClock = () => {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const yyyy = now.getFullYear();
            const mm = pad(now.getMonth() + 1);
            const dd = pad(now.getDate());
            const hh = pad(now.getHours());
            const min = pad(now.getMinutes());
            const sec = pad(now.getSeconds());
            clockEl.textContent = `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    switchTab(tabId) {
        // Handle Sidebar active button state
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.classList.remove("active");
            if (btn.getAttribute("data-tab") === tabId) {
                btn.classList.add("active");
            }
        });

        // Toggle panes
        document.querySelectorAll(".tab-pane").forEach(pane => {
            pane.classList.remove("active");
        });
        document.getElementById(tabId).classList.add("active");

        // Update titles
        const titles = {
            "dashboard-tab": ["Dashboard Overview", "Law enforcement portal for request templates and intelligence analysis."],
            "case-tab": ["Case Workspace", "Initialize case files, document suspects, and verify legal authorities."],
            "email-tab": ["Legal Notice Dispatcher", "Draft official freeze letters and statement orders with officer approvals."],
            "evidence-tab": ["Evidence Room", "Automated IMAP reply monitor and multi-stream forensic parser."],
            "forensics-tab": ["Forensics & AI Intelligence", "Visual call / transaction trends, timeline graphs, and Gemini correlation reports."],
            "audit-tab": ["Non-Editable Audit Trail", "Chronological records of all system actions and dispatched correspondence."],
            "settings-tab": ["System Configuration", "Define officer credentials, Gemini API key, and SMTP/IMAP credentials."]
        };

        const [title, subtitle] = titles[tabId] || ["Cyber Forensic Portal", "CFAA Agent Dashboard."];
        document.getElementById("page-title").textContent = title;
        document.getElementById("page-subtitle").textContent = subtitle;

        // Perform specific tab actions
        if (tabId === "audit-tab") {
            this.loadAuditTrail();
        } else if (tabId === "forensics-tab") {
            // Update forensics layout selection
            this.populateForensicsSourceSelector();
        }
    }

    showAlert(message, type = "success") {
        const container = document.getElementById("alert-container");
        const alert = document.createElement("div");
        alert.className = `alert alert-${type}`;
        
        let icon = "info";
        if (type === "success") icon = "check-circle";
        if (type === "error") icon = "alert-triangle";
        
        alert.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
        container.appendChild(alert);
        
        if (window.lucide) window.lucide.createIcons();
        
        // Auto remove
        setTimeout(() => {
            alert.style.animation = "slideIn 0.3s ease reverse forwards";
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    }

    autofillEditableData() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const dateValue = `${yyyy}-${mm}-${dd}`;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        setValue("case-input-id", "CR-2026-0088");
        setValue("case-input-fir", "FIR-119/2026");
        setValue("case-input-station", "Cyber Cell Varanasi");
        setValue("case-input-date", dateValue);
        setValue("case-input-officer", "Inspector Aditi Sharma");
        setValue("case-input-rank", "Police Inspector");
        setValue("case-input-email", "aditi.sharma.cyber@up.gov.in");
        setValue("case-input-purpose", "Trace the money trail of an online fraud, identify beneficiary accounts, and preserve telecom and transaction records for evidentiary review.");
        setValue("case-input-suspect", "Rahul Verma, approx. 29 years old, active in Delhi-NCR based UPI fraud network.");
        setValue("case-input-victim", "Amit Kumar, cyber fraud loss of Rs. 1,50,000 on 2026-07-24.");

        const authority = document.getElementById("case-input-authority");
        if (authority) {
            const preferredAuthority = "Section 94 / 106 BNSS (BNSS 2023)";
            authority.value = preferredAuthority;
            if (authority.value !== preferredAuthority && authority.options.length > 0) {
                authority.selectedIndex = 0;
            }
        }

        setValue("target-input-type", "bank");
        setValue("target-input-val", "123456789012");
        setValue("target-input-name", "Rahul Verma");
        setValue("target-input-entity", "State Bank of India");

        setValue("settings-officer-name", "Inspector Aditi Sharma");
        setValue("settings-officer-rank", "Police Inspector");
        setValue("settings-officer-badge", "B-9338");
        setValue("settings-officer-dept", "Cyber Cell Varanasi");
        setValue("settings-officer-contact", "9695732481");
        setValue("settings-officer-email", "aditi.sharma.cyber@up.gov.in");
        setValue("settings-officer-sig", "Inspector Aditi Sharma\nCyber Crime Cell, Varanasi Police Division");

        setValue("notice-case-id-display", document.getElementById("case-input-id")?.value || "CR-2026-0088");
        setValue("notice-legal-section", "Section 94 / 106 BNSS");
        setValue("notice-type-select", "statement");
        setValue("notice-entity-name", "State Bank of India");
        setValue("notice-additional-details", "Request bank statement history for 2026-07-20 to 2026-07-28, debit reference details, and linked beneficiary account metadata.");

        const targetSelect = document.getElementById("notice-target-select");
        if (targetSelect && targetSelect.options.length > 1) {
            targetSelect.selectedIndex = 1;
            targetSelect.dispatchEvent(new Event("change"));
        }

        this.showAlert("Demo data loaded. Review and edit the fields before submitting.");
    }

    // ----------------- SETTINGS MANAGEMENT -----------------

    async loadSettings() {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            this.settings = data;
            
            // Prefill Settings panel
            if (data.officer) {
                document.getElementById("settings-officer-name").value = data.officer.name || "";
                document.getElementById("settings-officer-rank").value = data.officer.rank || "";
                document.getElementById("settings-officer-badge").value = data.officer.badge_number || "";
                document.getElementById("settings-officer-dept").value = data.officer.department || "";
                document.getElementById("settings-officer-contact").value = data.officer.contact_number || "";
                document.getElementById("settings-officer-email").value = data.officer.email || "";
                document.getElementById("settings-officer-sig").value = data.officer.signature || "";
                
                // Update sidebar officer badge
                document.getElementById("sidebar-officer-name").textContent = data.officer.name || "Guest Officer";
                document.getElementById("sidebar-officer-dept").textContent = data.officer.department || "Cyber Cell Division";
            }
            
            if (data.smtp) {
                document.getElementById("settings-smtp-host").value = data.smtp.host || "";
                document.getElementById("settings-smtp-port").value = data.smtp.port || 587;
                document.getElementById("settings-smtp-user").value = data.smtp.user || "";
                document.getElementById("settings-smtp-sender").value = data.smtp.sender_name || "";
                if (data.smtp.has_password) {
                    document.getElementById("settings-smtp-pass").placeholder = "••••••••••••••••";
                }
            }

            if (data.has_api_key) {
                document.getElementById("settings-gemini-key").placeholder = "••••••••••••••••";
            }

            // Update status dots
            const geminiDot = document.getElementById("gemini-status-dot");
            const smtpDot = document.getElementById("smtp-status-dot");
            
            if (data.has_api_key) {
                geminiDot.className = "status-dot green";
            } else {
                geminiDot.className = "status-dot red";
            }
            
            if (data.smtp.has_password && data.smtp.host) {
                smtpDot.className = "status-dot green";
            } else {
                smtpDot.className = "status-dot red";
            }

        } catch (e) {
            console.error("Error loading settings:", e);
            this.showAlert("Failed to retrieve system settings.", "error");
        }
    }

    async handleSettingsSave(e, type) {
        e.preventDefault();
        
        let payload = {};
        if (type === "profile") {
            payload = {
                officer: {
                    name: document.getElementById("settings-officer-name").value,
                    rank: document.getElementById("settings-officer-rank").value,
                    badge_number: document.getElementById("settings-officer-badge").value,
                    department: document.getElementById("settings-officer-dept").value,
                    contact_number: document.getElementById("settings-officer-contact").value,
                    email: document.getElementById("settings-officer-email").value,
                    signature: document.getElementById("settings-officer-sig").value
                },
                gemini_api_key: document.getElementById("settings-gemini-key").value || undefined
            };
        } else if (type === "smtp") {
            const passVal = document.getElementById("settings-smtp-pass").value;
            payload = {
                smtp: {
                    host: document.getElementById("settings-smtp-host").value,
                    port: parseInt(document.getElementById("settings-smtp-port").value) || 587,
                    user: document.getElementById("settings-smtp-user").value,
                    sender_name: document.getElementById("settings-smtp-sender").value,
                    password: passVal || undefined
                }
            };
        }

        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === "success") {
                this.showAlert("Configuration saved successfully.");
                await this.loadSettings();
            } else {
                this.showAlert(data.message || "Failed to save settings.", "error");
            }
        } catch (err) {
            console.error("Save settings error:", err);
            this.showAlert("Failed to connect to backend api.", "error");
        }
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const eye = document.getElementById(`${inputId}-eye`);
        if (input.type === "password") {
            input.type = "text";
            eye.setAttribute("data-lucide", "eye-off");
        } else {
            input.type = "password";
            eye.setAttribute("data-lucide", "eye");
        }
        if (window.lucide) window.lucide.createIcons();
    }

    // ----------------- CASE WORKSPACE -----------------

    async loadCases() {
        try {
            const res = await fetch("/api/cases");
            const data = await res.json();
            this.cases = data;
            
            // Populate selector options
            const selector = document.getElementById("global-case-selector");
            selector.innerHTML = '<option value="">-- Select Active Case --</option>';
            
            data.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.case_id;
                opt.textContent = `${c.case_id} [FIR: ${c.fir_number}]`;
                selector.appendChild(opt);
            });
            
            // Restore active case if present
            if (this.activeCaseId) {
                selector.value = this.activeCaseId;
            }
            
            // Update stats
            document.getElementById("stat-cases").textContent = data.length;
            
            let totalDrafts = 0;
            let totalSent = 0;
            let totalEvidence = 0;
            
            data.forEach(c => {
                totalEvidence += c.evidence.length;
                c.requests.forEach(r => {
                    if (r.status === "sent") totalSent++;
                    else totalDrafts++;
                });
            });
            
            document.getElementById("stat-drafts").textContent = totalDrafts;
            document.getElementById("stat-dispatches").textContent = totalSent;
            document.getElementById("stat-evidence").textContent = totalEvidence;
            
        } catch (e) {
            console.error("Error listing cases:", e);
        }
    }

    async handleCaseCreate(e) {
        e.preventDefault();
        
        const payload = {
            case_id: document.getElementById("case-input-id").value,
            fir_number: document.getElementById("case-input-fir").value,
            police_station: document.getElementById("case-input-station").value,
            officer_name: document.getElementById("case-input-officer").value,
            officer_designation: document.getElementById("case-input-rank").value,
            official_email: document.getElementById("case-input-email").value,
            investigation_purpose: document.getElementById("case-input-purpose").value,
            legal_authority: document.getElementById("case-input-authority").value,
            date: document.getElementById("case-input-date").value || undefined,
            suspect_details: document.getElementById("case-input-suspect").value,
            victim_details: document.getElementById("case-input-victim").value
        };

        try {
            const res = await fetch("/api/cases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Validation failed.");
            }
            
            const caseObj = await res.json();
            this.showAlert(`Case ${caseObj.case_id} intake completed successfully.`);
            
            document.getElementById("case-intake-form").reset();
            
            // Update active case
            this.activeCaseId = caseObj.case_id;
            await this.loadCases();
            this.setActiveCase(caseObj.case_id);
            
        } catch (err) {
            console.error("Create case error:", err);
            this.showAlert(err.message, "error");
        }
    }

    async setActiveCase(caseId) {
        this.activeCaseId = caseId;
        document.getElementById("global-case-selector").value = caseId;
        
        if (!caseId) {
            this.clearCaseViews();
            return;
        }

        // Fetch case details from backend
        try {
            const res = await fetch(`/api/cases/${caseId}`);
            if (!res.ok) throw new Error("Could not find case.");
            
            const cObj = await res.json();
            
            // Sync with local cases list
            const idx = this.cases.findIndex(c => c.case_id === caseId);
            if (idx !== -1) {
                this.cases[idx] = cObj;
            } else {
                this.cases.push(cObj);
            }
            
            this.renderCaseWorkspaceViews(cObj);
        } catch (err) {
            this.showAlert(err.message, "error");
            this.clearCaseViews();
        }
    }

    clearCaseViews() {
        // Reset checklist checkboxes
        document.getElementById("legal-check-authority").checked = false;
        document.getElementById("legal-check-approvals").checked = false;
        document.getElementById("legal-check-proportionate").checked = false;
        this.verifyLegalValidationGate();

        // Targets table empty
        document.getElementById("case-targets-table").querySelector("tbody").innerHTML = 
            '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 20px;">No targets added. Submit the Intake Form first, then add targets.</td></tr>';
            
        // Draft notice dropdowns empty
        document.getElementById("notice-case-id-display").value = "";
        document.getElementById("notice-target-select").innerHTML = '<option value="">-- Select Target --</option>';
        document.getElementById("case-requests-table").querySelector("tbody").innerHTML = 
            '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 10px;">No drafts created.</td></tr>';
            
        // Evidence tab empty
        document.getElementById("case-evidence-table").querySelector("tbody").innerHTML = 
            '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 20px;">No evidence files uploaded/polled.</td></tr>';
            
        // Timeline empty
        document.getElementById("case-timeline-container").innerHTML = '<span class="small-text text-muted">Create case to initiate timeline logs.</span>';
    }

    renderCaseWorkspaceViews(caseObj) {
        // 1. Targets rendering
        const targetsTable = document.getElementById("case-targets-table").querySelector("tbody");
        if (caseObj.targets.length === 0) {
            targetsTable.innerHTML = '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 20px;">No suspect identifiers linked. Add below.</td></tr>';
        } else {
            targetsTable.innerHTML = "";
            caseObj.targets.forEach(t => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${t.type.toUpperCase()}</strong></td>
                    <td><code>${t.identifier}</code></td>
                    <td>${t.entity_name} ${t.name ? '('+t.name+')' : ''}</td>
                    <td><button class="trash-btn" onclick="app.showAlert('Identifier is locked in case database.', 'info')"><i data-lucide="lock" style="width: 14px; height: 14px;"></i></button></td>
                `;
                targetsTable.appendChild(row);
            });
            if (window.lucide) window.lucide.createIcons();
        }

        // 2. Load targets into Notice generator dropdown
        const noticeTargetSel = document.getElementById("notice-target-select");
        noticeTargetSel.innerHTML = '<option value="">-- Select Target --</option>';
        caseObj.targets.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.identifier;
            opt.textContent = `${t.type.toUpperCase()}: ${t.identifier} (${t.entity_name})`;
            noticeTargetSel.appendChild(opt);
        });

        // Prefill Notice Case parameters
        document.getElementById("notice-case-id-display").value = caseObj.case_id;
        document.getElementById("notice-legal-section").value = caseObj.legal_authority.split(" ")[0]; // prefill like Section 91
        
        // Auto fill institutional name when target changes in Notice tab
        noticeTargetSel.onchange = (e) => {
            const chosenVal = e.target.value;
            const target = caseObj.targets.find(t => t.identifier === chosenVal);
            if (target) {
                document.getElementById("notice-entity-name").value = target.entity_name;
            }
        };

        // 3. Render notice request workflows
        const requestsTable = document.getElementById("case-requests-table").querySelector("tbody");
        if (caseObj.requests.length === 0) {
            requestsTable.innerHTML = '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 10px;">No drafts created.</td></tr>';
        } else {
            requestsTable.innerHTML = "";
            caseObj.requests.forEach(req => {
                const badgeClass = req.status === "sent" ? "badge-success" : "badge-warning";
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${req.type.toUpperCase()}</td>
                    <td><code>${req.target_identifier}</code></td>
                    <td>${req.entity_name}</td>
                    <td><span class="draft-badge ${badgeClass}">${req.status}</span></td>
                `;
                row.style.cursor = "pointer";
                row.onclick = () => this.loadRequestDraftToPreview(req);
                requestsTable.appendChild(row);
            });
        }

        // 4. Render evidence files
        const evidenceTable = document.getElementById("case-evidence-table").querySelector("tbody");
        if (caseObj.evidence.length === 0) {
            evidenceTable.innerHTML = '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 20px;">No evidence files uploaded/polled.</td></tr>';
        } else {
            evidenceTable.innerHTML = "";
            caseObj.evidence.forEach(ev => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle;"></i> ${ev.filename}</td>
                    <td><span class="draft-badge" style="background: rgba(6,182,212,0.15); color: var(--primary);">${ev.type.toUpperCase()}</span></td>
                    <td><span style="font-size: 0.75rem;">${ev.uploaded_at}</span></td>
                    <td><button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.7rem;" onclick="app.viewEvidenceStats('${ev.id}')">View</button></td>
                `;
                evidenceTable.appendChild(row);
            });
            if (window.lucide) window.lucide.createIcons();
        }

        // 5. Render Chronological Timeline (Phase 13)
        const timelineBox = document.getElementById("case-timeline-container");
        if (caseObj.timeline.length === 0) {
            timelineBox.innerHTML = '<span class="small-text text-muted">Timeline is blank.</span>';
        } else {
            timelineBox.innerHTML = "";
            // Reverse chronological order (newest first)
            const sortedTimeline = [...caseObj.timeline].reverse();
            sortedTimeline.forEach(event => {
                const evCard = document.createElement("div");
                evCard.className = `timeline-event-card ${event.category || 'custom'}`;
                evCard.innerHTML = `
                    <div class="timeline-event-header">
                        <span>${event.event_type}</span>
                        <span class="timeline-event-time">${event.timestamp}</span>
                    </div>
                    <p class="timeline-event-desc">${event.description}</p>
                `;
                timelineBox.appendChild(evCard);
            });
        }

        // Verify checkbox states in local storage or resets
        this.verifyLegalValidationGate();
    }

    async handleTargetAdd(e) {
        e.preventDefault();
        if (!this.activeCaseId) {
            this.showAlert("Please select or create an active case first.", "error");
            return;
        }

        const payload = {
            type: document.getElementById("target-input-type").value,
            identifier: document.getElementById("target-input-val").value,
            name: document.getElementById("target-input-name").value,
            entity_name: document.getElementById("target-input-entity").value,
            details: ""
        };

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/targets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add target.");
            }
            
            this.showAlert("Suspect identifier linked successfully.");
            document.getElementById("add-target-form").reset();
            
            // Reload case details
            await this.setActiveCase(this.activeCaseId);
            
        } catch (err) {
            this.showAlert(err.message, "error");
        }
    }

    verifyLegalValidationGate() {
        const checks = [
            document.getElementById("legal-check-authority").checked,
            document.getElementById("legal-check-approvals").checked,
            document.getElementById("legal-check-proportionate").checked
        ];
        
        const badge = document.getElementById("legal-validation-badge");
        const btnApprove = document.getElementById("btn-approve-notice");
        const allChecked = checks.every(c => c === true);
        
        if (allChecked) {
            badge.textContent = "Verified";
            badge.style.background = "rgba(16,185,129,0.1)";
            badge.style.color = "var(--success)";
            badge.style.borderColor = "rgba(16,185,129,0.2)";
            
            btnApprove.disabled = false;
            btnApprove.style.opacity = "1";
            btnApprove.style.cursor = "pointer";
        } else {
            badge.textContent = "Pending Checks";
            badge.style.background = "rgba(239,68,68,0.1)";
            badge.style.color = "var(--danger)";
            badge.style.borderColor = "rgba(239,68,68,0.2)";
            
            btnApprove.disabled = true;
            btnApprove.style.opacity = "0.4";
            btnApprove.style.cursor = "not-allowed";
        }
    }

    // ----------------- NOTICE DRAFTER -----------------

    async handleNoticeGenerate(e) {
        e.preventDefault();
        if (!this.activeCaseId) {
            this.showAlert("Please select or create an active case first.", "error");
            return;
        }

        const targetSelect = document.getElementById("notice-target-select");
        const targetIdent = targetSelect.value;
        if (!targetIdent) {
            this.showAlert("Please select a target identifier.", "error");
            return;
        }

        // Get details (always fetch fresh case details from local synced state or API)
        const cObj = this.cases.find(c => c.case_id === this.activeCaseId);
        if (!cObj) {
            this.showAlert("Active case details not found.", "error");
            return;
        }
        const targetObj = cObj.targets.find(t => t.identifier === targetIdent);
        if (!targetObj) {
            this.showAlert("Selected target identifier is not found in the case record.", "error");
            return;
        }

        const payload = {
            template_type: document.getElementById("notice-type-select").value,
            case_number: cObj.fir_number,
            target_name: targetObj.name || "Unknown Owner",
            target_identifier: targetIdent,
            entity_name: document.getElementById("notice-entity-name").value,
            legal_section: document.getElementById("notice-legal-section").value,
            additional_details: document.getElementById("notice-additional-details").value
        };

        try {
            const res = await fetch("/api/generate-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            // Create a draft in backend case requests list
            const reqPayload = {
                type: payload.template_type,
                target_identifier: targetIdent,
                entity_name: payload.entity_name,
                legal_section: payload.legal_section,
                subject: data.subject,
                body: data.body
            };

            const reqRes = await fetch(`/api/cases/${this.activeCaseId}/requests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqPayload)
            });
            
            const newRequest = await reqRes.json();
            this.showAlert("Notice draft generated successfully.");
            
            // Load this new request details to preview
            await this.setActiveCase(this.activeCaseId);
            this.loadRequestDraftToPreview(newRequest);
            
        } catch (err) {
            console.error("Notice draft generate failed:", err);
            this.showAlert("Failed to generate notice draft.", "error");
        }
    }

    loadRequestDraftToPreview(req) {
        this.activeDraft = req;
        
        document.getElementById("notice-output-subject").value = req.subject;
        document.getElementById("notice-output-body").value = req.body;
        
        const badge = document.getElementById("notice-status-badge");
        badge.textContent = req.status.toUpperCase();
        
        const btnSend = document.getElementById("btn-send-notice");
        
        if (req.status === "sent") {
            badge.style.background = "rgba(16,185,129,0.1)";
            badge.style.color = "var(--success)";
            
            btnSend.disabled = true;
            btnSend.style.opacity = "0.4";
            btnSend.style.cursor = "not-allowed";
        } else if (req.status === "approved") {
            badge.style.background = "rgba(6,182,212,0.1)";
            badge.style.color = "var(--primary)";
            
            btnSend.disabled = false;
            btnSend.style.opacity = "1";
            btnSend.style.cursor = "pointer";
        } else {
            badge.style.background = "rgba(245,158,11,0.1)";
            badge.style.color = "var(--warning)";
            
            btnSend.disabled = true;
            btnSend.style.opacity = "0.4";
            btnSend.style.cursor = "not-allowed";
        }
    }

    approveActiveNotice() {
        if (!this.activeDraft) {
            this.showAlert("No active notice loaded to approve.", "error");
            return;
        }

        // Verify Legal checks are complete
        const checks = [
            document.getElementById("legal-check-authority").checked,
            document.getElementById("legal-check-approvals").checked,
            document.getElementById("legal-check-proportionate").checked
        ];
        
        if (!checks.every(c => c === true)) {
            this.showAlert("Legal validation checks must be verified before approval.", "error");
            return;
        }

        this.updateRequestStatus("approved");
    }

    async updateRequestStatus(status, details = {}) {
        try {
            const payload = {
                status: status,
                subject: document.getElementById("notice-output-subject").value,
                body: document.getElementById("notice-output-body").value,
                ...details
            };
            
            const res = await fetch(`/api/cases/${this.activeCaseId}/requests/${this.activeDraft.id}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const updatedReq = await res.json();
            this.showAlert(`Notice status promoted to: ${status.toUpperCase()}.`);
            
            await this.setActiveCase(this.activeCaseId);
            this.loadRequestDraftToPreview(updatedReq);
        } catch (err) {
            this.showAlert("Failed to promote notice status.", "error");
        }
    }

    copyActiveNotice() {
        const subject = document.getElementById("notice-output-subject").value;
        const body = document.getElementById("notice-output-body").value;
        
        if (!subject && !body) {
            this.showAlert("Nothing to copy.", "error");
            return;
        }

        const text = `Subject: ${subject}\n\n${body}`;
        navigator.clipboard.writeText(text);
        this.showAlert("Copied notice to clipboard.");
    }

    launchActiveMailClient() {
        const subject = document.getElementById("notice-output-subject").value;
        const body = document.getElementById("notice-output-body").value;
        if (!subject) return;
        
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto);
    }

    // ----------------- SMTP EMAIL SENDER MODAL -----------------

    dispatchActiveNotice() {
        if (!this.activeDraft || this.activeDraft.status !== "approved") {
            this.showAlert("Only APPROVED drafts can be dispatched via SMTP.", "error");
            return;
        }

        // Prefill modal
        document.getElementById("modal-recipient-email").value = "";
        document.getElementById("modal-subject-preview").textContent = document.getElementById("notice-output-subject").value;
        document.getElementById("modal-body-preview").textContent = document.getElementById("notice-output-body").value;
        
        document.getElementById("smtp-modal").classList.remove("hidden");
    }

    closeSmtpModal() {
        document.getElementById("smtp-modal").classList.add("hidden");
    }

    async submitSmtpEmail() {
        const recipient = document.getElementById("modal-recipient-email").value.trim();
        if (!recipient) {
            this.showAlert("Recipient email is required.", "error");
            return;
        }

        const payload = {
            recipient_email: recipient,
            subject: document.getElementById("notice-output-subject").value,
            body: document.getElementById("notice-output-body").value,
            case_id: this.activeCaseId,
            request_id: this.activeDraft.id
        };

        this.closeSmtpModal();
        this.showAlert("SMTP dispatch thread started...", "info");

        try {
            const res = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "SMTP transmission failure.");
            }
            
            const data = await res.json();
            this.showAlert(`Notice dispatched. MsgID: ${data.message_id}`);
            
            // Reload case details to update sent timestamp
            await this.setActiveCase(this.activeCaseId);
            this.activeDraft = null;
            this.clearNoticeOutputArea();
            
        } catch (err) {
            console.error("SMTP error:", err);
            this.showAlert(err.message, "error");
        }
    }

    clearNoticeOutputArea() {
        document.getElementById("notice-output-subject").value = "";
        document.getElementById("notice-output-body").value = "";
        document.getElementById("notice-status-badge").textContent = "No Active Draft";
        const btnSend = document.getElementById("btn-send-notice");
        btnSend.disabled = true;
        btnSend.style.opacity = "0.4";
        btnSend.style.cursor = "not-allowed";
    }

    // ----------------- IMAP MAIL POLL & CLASSIFY -----------------

    async pollInboxForActiveCase() {
        if (!this.activeCaseId) {
            this.showAlert("Select a Case ID first to parse matching replies.", "error");
            return;
        }

        const spinner = document.getElementById("poll-mailbox-spinner");
        const btn = document.getElementById("btn-poll-mailbox");
        
        spinner.classList.remove("hidden");
        btn.disabled = true;
        btn.style.opacity = "0.5";

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/poll-mail`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "IMAP search failure.");
            }
            const data = await res.json();
            this.showAlert(data.message);
            
            // Refresh Active case details
            await this.setActiveCase(this.activeCaseId);
            
        } catch (err) {
            console.error("IMAP error:", err);
            this.showAlert(err.message, "error");
        } finally {
            spinner.classList.add("hidden");
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }

    // ----------------- DRAG & DROP EVIDENCE ZONE -----------------

    initDragAndDrop() {
        const zone = document.getElementById("evidence-upload-zone");
        const input = document.getElementById("evidence-file-input");
        
        zone.addEventListener("click", () => input.click());
        
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.style.borderColor = "var(--primary)";
        });
        
        zone.addEventListener("dragleave", () => {
            zone.style.borderColor = "rgba(6,182,212,0.15)";
        });
        
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.style.borderColor = "rgba(6,182,212,0.15)";
            if (e.dataTransfer.files.length) {
                this.uploadEvidenceFile(e.dataTransfer.files[0]);
            }
        });
        
        input.addEventListener("change", () => {
            if (input.files.length) {
                this.uploadEvidenceFile(input.files[0]);
                input.value = ""; // clear
            }
        });
    }

    async uploadEvidenceFile(file) {
        if (!this.activeCaseId) {
            this.showAlert("Please select an active Case ID context for this file.", "error");
            return;
        }

        const fileType = document.getElementById("evidence-upload-type").value;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("file_type", fileType);

        const spinner = document.getElementById("evidence-upload-spinner");
        spinner.classList.remove("hidden");

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/evidence/upload`, {
                method: "POST",
                body: formData
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Upload ingestion failed.");
            }
            
            const data = await res.json();
            this.showAlert(`Evidence uploaded and parsed successfully.`);
            
            // Reload case details
            await this.setActiveCase(this.activeCaseId);
            
            // Show preview stats
            this.renderUploadedFileStatsPreview(data);
            
        } catch (err) {
            console.error("Upload error:", err);
            this.showAlert(err.message, "error");
        } finally {
            spinner.classList.add("hidden");
        }
    }

    renderUploadedFileStatsPreview(data) {
        const preview = document.getElementById("evidence-parsed-preview");
        preview.classList.remove("hidden");
        
        document.getElementById("evidence-preview-filename").textContent = data.filename;
        document.getElementById("evidence-preview-type").textContent = data.file_type.toUpperCase();
        
        const statsBox = document.getElementById("evidence-preview-stats-list");
        statsBox.innerHTML = "";
        
        if (data.file_type === "cdr") {
            const s = data.stats || {};
            const totalRecords = s.total_records !== undefined ? s.total_records : "N/A";
            const dateRange = s.date_range || "N/A";
            const suspectCandidate = s.suspect_candidate || "N/A";
            const nightCalls = s.night_calls_count !== undefined ? s.night_calls_count : "N/A";
            const imeiSwapsCount = Array.isArray(s.imei_swaps) ? s.imei_swaps.length : 0;
            
            statsBox.innerHTML = `
                <div><strong>Total Calls Found:</strong> ${totalRecords}</div>
                <div><strong>Date Span:</strong> ${dateRange}</div>
                <div><strong>Primary Suspect SIM Candidate:</strong> <code>${suspectCandidate}</code></div>
                <div><strong>Nighttime Calls (10pm-6am):</strong> ${nightCalls}</div>
                <div><strong>SIM Swaps (IMEI swaps):</strong> ${imeiSwapsCount} detected</div>
            `;
        } else if (data.file_type === "bank_statement") {
            const s = data.stats || {};
            const totalRecords = s.total_records !== undefined ? s.total_records : "N/A";
            const totalDebits = s.total_debits !== undefined ? s.total_debits : 0;
            const totalCredits = s.total_credits !== undefined ? s.total_credits : 0;
            const debitCount = s.debit_count !== undefined ? s.debit_count : 0;
            const creditCount = s.credit_count !== undefined ? s.credit_count : 0;
            const suspPatternsCount = Array.isArray(s.suspicious_patterns) ? s.suspicious_patterns.length : 0;
            
            statsBox.innerHTML = `
                <div><strong>Total Ledger Entries:</strong> ${totalRecords}</div>
                <div><strong>Aggregated Debits (Outflows):</strong> Rs. ${totalDebits.toLocaleString()} (${debitCount} txs)</div>
                <div><strong>Aggregated Credits (Inflows):</strong> Rs. ${totalCredits.toLocaleString()} (${creditCount} txs)</div>
                <div><strong>Suspicious Alerts:</strong> ${suspPatternsCount} flagged patterns</div>
            `;
        } else if (data.file_type === "reply" || data.file_type === "kyc") {
            const s = data.stats || {};
            const sender = s.sender || "N/A";
            const receivedDate = s.received_date || "N/A";
            const subject = s.email_subject || "N/A";
            const content = data.content || "No message body extracted.";
            
            statsBox.innerHTML = `
                <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 10px; font-size: 0.75rem;">
                    <div><strong>From:</strong> ${sender}</div>
                    <div><strong>Date:</strong> ${receivedDate}</div>
                    <div><strong>Subject:</strong> <span class="neon-text">${subject}</span></div>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; font-family: var(--font-code); font-size: 0.75rem; white-space: pre-wrap; max-height: 250px; overflow-y: auto;">${content}</div>
            `;
        } else {
            const content = data.content || "Document routed to general case file repository. Ready for AI cross-correlation.";
            statsBox.innerHTML = `
                <div><strong>General Case File / Response Preview</strong></div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; font-family: var(--font-code); font-size: 0.75rem; white-space: pre-wrap; max-height: 250px; overflow-y: auto; margin-top: 8px;">${content}</div>
            `;
        }
    }

    async viewEvidenceStats(evidenceId) {
        if (!this.activeCaseId) return;
        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/evidence/${evidenceId}/content`);
            if (!res.ok) throw new Error("Could not fetch evidence contents.");
            const data = await res.json();
            
            this.renderUploadedFileStatsPreview({
                filename: data.filename,
                file_type: data.type,
                stats: data.metadata,
                content: data.content
            });
            
            // Alert confirmation
            this.showAlert(`Loaded details for ${data.filename}.`);
            
            // Automatically set forensics tab chart select source if it's a parseable format
            if (data.type === "cdr" || data.type === "bank_statement") {
                // Populate the selector first to ensure the newly parsed file is an option
                await this.populateForensicsSourceSelector();
                
                this.switchTab("forensics-tab");
                const sourceSelect = document.getElementById("forensics-chart-source");
                sourceSelect.value = evidenceId;
                this.loadForensicsCharts(evidenceId);
            }
        } catch (e) {
            console.error(e);
            this.showAlert("Failed to view evidence file.", "error");
        }
    }

    // ----------------- FORENSICS VISUALIZATION & REPORTS -----------------

    async populateForensicsSourceSelector() {
        const sourceSelect = document.getElementById("forensics-chart-source");
        const currentVal = sourceSelect.value;
        sourceSelect.innerHTML = '<option value="">-- Select Chart Data Source --</option>';
        
        if (!this.activeCaseId) return;
        
        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}`);
            const caseObj = await res.json();
            
            let firstEvId = null;
            (caseObj.evidence || []).forEach(ev => {
                if (ev.type === "cdr" || ev.type === "bank_statement") {
                    const opt = document.createElement("option");
                    opt.value = ev.id;
                    opt.textContent = `${ev.type.toUpperCase()}: ${ev.filename}`;
                    sourceSelect.appendChild(opt);
                    if (!firstEvId) firstEvId = ev.id;
                }
            });
            
            // Restore previous choice if valid, or auto-select first available dataset to immediately render charts
            if (currentVal && (caseObj.evidence || []).some(e => e.id === currentVal)) {
                sourceSelect.value = currentVal;
                this.loadForensicsCharts(currentVal);
            } else if (firstEvId) {
                sourceSelect.value = firstEvId;
                this.loadForensicsCharts(firstEvId);
            }
        } catch (e) {
            console.error("Failed to populate forensics source selector:", e);
        }
    }


    async loadForensicsCharts(evidenceId) {
        // Clear previous charts
        if (this.charts.hourly) this.charts.hourly.destroy();
        if (this.charts.daily) this.charts.daily.destroy();
        
        const contactsTable = document.getElementById("forensics-table-contacts").querySelector("tbody");
        const alertsTable = document.getElementById("forensics-table-alerts").querySelector("tbody");
        
        contactsTable.innerHTML = '<tr><td colspan="2">No source selected.</td></tr>';
        alertsTable.innerHTML = '<tr><td colspan="2">No source selected.</td></tr>';
        
        if (!evidenceId || !this.activeCaseId) return;

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}`);
            const caseObj = await res.json();
            const ev = caseObj.evidence.find(x => x.id === evidenceId);
            
            if (!ev || !ev.metadata || Object.keys(ev.metadata).length === 0) return;
            const s = ev.metadata;

            if (ev.type === "cdr") {
                // 1. Hourly distribution chart
                const hourlyLabels = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);
                let hourlyData = Array(24).fill(0);
                if (s.hourly_distribution) {
                    Object.entries(s.hourly_distribution).forEach(([hr, cnt]) => {
                        hourlyData[parseInt(hr)] = cnt;
                    });
                }
                
                const ctxH = document.getElementById("forensics-hourly-chart").getContext("2d");
                this.charts.hourly = new Chart(ctxH, {
                    type: 'bar',
                    data: {
                        labels: hourlyLabels,
                        datasets: [{
                            label: 'Call Density by hour of day',
                            data: hourlyData,
                            backgroundColor: 'rgba(6, 182, 212, 0.4)',
                            borderColor: 'rgb(6, 182, 212)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } }
                    }
                });

                // 2. Daily distribution chart
                const dailyLabels = Object.keys(s.daily_distribution || {}).sort();
                const dailyData = dailyLabels.map(d => s.daily_distribution[d]);
                
                const ctxD = document.getElementById("forensics-daily-chart").getContext("2d");
                this.charts.daily = new Chart(ctxD, {
                    type: 'line',
                    data: {
                        labels: dailyLabels,
                        datasets: [{
                            label: 'Call volume trend line',
                            data: dailyData,
                            borderColor: 'rgb(139, 92, 246)',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } }
                    }
                });

                // 3. Contacts Table
                contactsTable.innerHTML = "";
                Object.entries(s.top_contacts || {}).slice(0, 10).forEach(([num, freq]) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td><code>${num}</code></td><td>${freq} times</td>`;
                    contactsTable.appendChild(tr);
                });

                // 4. Alerts Table
                alertsTable.innerHTML = "";
                if (s.imei_swaps && s.imei_swaps.length > 0) {
                    s.imei_swaps.forEach(swap => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `<td>IMEI Swap</td><td>Number ${swap.number} swapped devices between IMEIs: ${swap.imeis.join(", ")}</td>`;
                        alertsTable.appendChild(tr);
                    });
                } else {
                    alertsTable.innerHTML = '<tr><td colspan="2" class="sub-text">No SIM/device IMEI swaps detected.</td></tr>';
                }

            } else if (ev.type === "bank_statement") {
                // Bank statement charts
                // 1. Credit vs Debit totals by category
                const catLabels = Object.keys(s.categories || {});
                const debitData = catLabels.map(c => s.categories[c].debit_total);
                const creditData = catLabels.map(c => s.categories[c].credit_total);
                
                const ctxH = document.getElementById("forensics-hourly-chart").getContext("2d");
                this.charts.hourly = new Chart(ctxH, {
                    type: 'bar',
                    data: {
                        labels: catLabels,
                        datasets: [
                            {
                                label: 'Debit Sum (Outflow)',
                                data: debitData,
                                backgroundColor: 'rgba(239, 68, 68, 0.5)',
                                borderColor: 'rgb(239, 68, 68)',
                                borderWidth: 1
                            },
                            {
                                label: 'Credit Sum (Inflow)',
                                data: creditData,
                                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                                borderColor: 'rgb(16, 185, 129)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } }
                    }
                });

                // 2. Transaction trends (Daily debit sum line)
                const dailyLabels = Object.keys(s.daily_stats || {}).sort();
                const dailyDebits = dailyLabels.map(d => s.daily_stats[d].debit);
                const dailyCredits = dailyLabels.map(d => s.daily_stats[d].credit);
                
                const ctxD = document.getElementById("forensics-daily-chart").getContext("2d");
                this.charts.daily = new Chart(ctxD, {
                    type: 'line',
                    data: {
                        labels: dailyLabels,
                        datasets: [
                            {
                                label: 'Daily Outflows',
                                data: dailyDebits,
                                borderColor: 'rgb(239, 68, 68)',
                                fill: false
                            },
                            {
                                label: 'Daily Inflows',
                                data: dailyCredits,
                                borderColor: 'rgb(16, 185, 129)',
                                fill: false
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });

                // 3. Counterparties Table
                contactsTable.innerHTML = "";
                Object.entries(s.top_counterparts || {}).forEach(([cp, data]) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td><code>${cp}</code></td><td>Rs. ${data.volume.toLocaleString()} (${data.count} txs)</td>`;
                    contactsTable.appendChild(tr);
                });

                // 4. Alerts Table
                alertsTable.innerHTML = "";
                if (s.suspicious_patterns && s.suspicious_patterns.length > 0) {
                    s.suspicious_patterns.forEach(pat => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `<td><span class="draft-badge badge-danger">${pat.type}</span></td><td>${pat.description}</td>`;
                        alertsTable.appendChild(tr);
                    });
                } else {
                    alertsTable.innerHTML = '<tr><td colspan="2" class="sub-text">No suspicious transaction velocity cycles triggered.</td></tr>';
                }
            }
        } catch (e) {
            console.error("Forensics chart error:", e);
        }
    }

    toggleAccordion(header) {
        const item = header.parentElement;
        item.classList.toggle("active");
    }

    // ----------------- GEMINI AI GENERATIVE REPORT RUNNERS -----------------

    async runCaseEvidenceCorrelation() {
        if (!this.activeCaseId) {
            this.showAlert("Please select an active Case ID first.", "error");
            return;
        }

        const spinner = document.getElementById("forensics-ai-loading");
        const outputBox = document.getElementById("forensics-ai-output-box");
        
        spinner.classList.remove("hidden");
        outputBox.classList.add("hidden");

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/correlate`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "AI engine timeout.");
            }
            const data = await res.json();
            
            document.getElementById("forensics-ai-title").textContent = `Phase 12: Cross-Evidence Correlation Report [${this.activeCaseId}]`;
            
            const markdownText = data.correlation_report;
            // Render markdown using marked
            document.getElementById("forensics-ai-report-content").innerHTML = marked.parse(markdownText);
            
            outputBox.classList.remove("hidden");
            this.showAlert("Cross-evidence correlation completed.");
            
            // Reload case details to update timeline
            await this.setActiveCase(this.activeCaseId);
            
        } catch (err) {
            console.error("Correlation error:", err);
            this.showAlert(err.message, "error");
        } finally {
            spinner.classList.add("hidden");
        }
    }

    async runCaseInvestigationSummary() {
        if (!this.activeCaseId) {
            this.showAlert("Please select an active Case ID first.", "error");
            return;
        }

        const spinner = document.getElementById("forensics-ai-loading");
        const outputBox = document.getElementById("forensics-ai-output-box");
        
        spinner.classList.remove("hidden");
        outputBox.classList.add("hidden");

        try {
            const res = await fetch(`/api/cases/${this.activeCaseId}/summary`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "AI engine timeout.");
            }
            const data = await res.json();
            
            document.getElementById("forensics-ai-title").textContent = `Phase 14: Final Case Investigation Summary [${this.activeCaseId}]`;
            
            const markdownText = data.case_summary;
            document.getElementById("forensics-ai-report-content").innerHTML = marked.parse(markdownText);
            
            outputBox.classList.remove("hidden");
            this.showAlert("Final Case Investigation Summary compiled.");
            
            // Reload case details
            await this.setActiveCase(this.activeCaseId);
            
        } catch (err) {
            console.error("Summary error:", err);
            this.showAlert(err.message, "error");
        } finally {
            spinner.classList.add("hidden");
        }
    }

    copyForensicReport() {
        const text = document.getElementById("forensics-ai-report-content").innerText;
        if (!text) return;
        navigator.clipboard.writeText(text);
        this.showAlert("Report content copied to clipboard.");
    }

    downloadForensicReport() {
        const text = document.getElementById("forensics-ai-report-content").innerText;
        if (!text) return;
        
        const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `CFAA_Forensic_Report_${this.activeCaseId || 'Export'}.md`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ----------------- AUDIT TRAIL -----------------

    async loadAuditTrail() {
        const tableBody = document.getElementById("audit-trail-table").querySelector("tbody");
        try {
            const res = await fetch("/api/audit-trail");
            const data = await res.json();
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="sub-text" style="text-align: center; padding: 20px;">No audit trail entries logged.</td></tr>';
                return;
            }

            tableBody.innerHTML = "";
            // Reverse chronological (newest logs first)
            const sortedLogs = [...data].reverse();
            sortedLogs.forEach(entry => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="code-font" style="color: var(--text-muted);">${entry.timestamp}</td>
                    <td><strong>${entry.officer}</strong></td>
                    <td><span class="draft-badge" style="background: rgba(139,92,246,0.1); color: var(--secondary); border: none; padding: 2px 8px;">${entry.action}</span></td>
                    <td class="code-font" style="font-size: 0.75rem;"><pre style="margin: 0; white-space: pre-wrap; font-family: inherit; color: var(--text-secondary);">${JSON.stringify(entry.details, null, 2)}</pre></td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (e) {
            console.error("Error loading audit trail:", e);
        }
    }

    // Helper: download mock CSV template
    downloadMockTemplate() {
        const link = document.createElement("a");
        link.href = "/mock_cdr.csv";
        link.download = "mock_cdr.csv";
        link.click();
        this.showAlert("Mock CDR file download initiated.");
    }
}

// Instantiate App globally
window.app = new CFAAApp();

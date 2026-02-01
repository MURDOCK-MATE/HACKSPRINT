const MW = (() => {
    // App state
    let isAuthorityAuthenticated = false;
    let allReports = [];
    let statsRefreshInterval = null;

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getStatusColor(status) {
        switch(status) {
            case 'pending': return 'pending';
            case 'investigating': return 'investigating';
            case 'resolved': return 'resolved';
            default: return 'pending';
        }
    }

    async function updateStats() {
        if (typeof FirebaseService === 'undefined') {
            console.error('FirebaseService not loaded');
            return;
        }

        try {
            const result = await FirebaseService.getReportStats();
            if (result.success) {
                const stats = result.stats;
                
                // Update home page stats
                animateCounter('totalReports', stats.totalReports);
                animateCounter('resolvedPercentage', stats.resolvedPercentage, '%');
                
                // Update authority dashboard stats
                animateCounter('pendingReports', stats.pendingReports);
                animateCounter('investigating', stats.investigatingReports);
                animateCounter('resolved', stats.resolvedReports);
                
                // Update leaderboard stats
                animateCounter('activeReporters', stats.activeReporters);
                animateCounter('thisWeek', stats.thisWeekReports);
            }
        } catch (error) {
            console.error('Stats update failed:', error);
        }
    }
    
    function animateCounter(elementId, targetValue, suffix = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = parseInt(element.textContent) || 0;
        const increment = (targetValue - startValue) / 30;
        let currentValue = startValue;

        const timer = setInterval(() => {
            currentValue += increment;
            if ((increment > 0 && currentValue >= targetValue) || 
                (increment < 0 && currentValue <= targetValue)) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(currentValue) + suffix;
        }, 50);
    }

    // User Authentication Handlers
    async function bindUserLogin() {
        const form = document.getElementById("userLoginForm");
        if (!form) return;

        form.addEventListener("submit", async e => {
            e.preventDefault();
            
            if (typeof FirebaseService === 'undefined') {
                showNotification('Firebase not initialized. Please check your configuration.', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            const email = document.getElementById('userEmail').value.trim();
            const password = document.getElementById('userPassword').value;

            // Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
            submitBtn.disabled = true;

            try {
                const result = await FirebaseService.loginUser(email, password);

                if (result.success) {
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Signed In!';
                    submitBtn.style.background = 'var(--success)';
                    setTimeout(() => { showPage('home'); }, 1500);
                } else {
                    showNotification(result.error, "error");
                    submitBtn.innerHTML = originalHTML;
                    submitBtn.disabled = false;
                }
            } catch (err) {
                showNotification('Login failed: ' + (err?.message || err), 'error');
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });
    }

    async function bindUserRegister() {
        const form = document.getElementById("userRegisterForm");
        if (!form) return;

        form.addEventListener("submit", async e => {
            e.preventDefault();
            
            if (typeof FirebaseService === 'undefined') {
                showNotification('Firebase not initialized. Please check your configuration.', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            const fullName = document.getElementById('regFullName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const phone = document.getElementById('regPhone').value.trim();

            // Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            submitBtn.disabled = true;

            try {
                const result = await FirebaseService.registerUser(email, password, fullName, phone);

                if (result.success) {
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Account Created!';
                    submitBtn.style.background = 'var(--success)';

                    if (result.needsEmailConfirmation) {
                        showNotification(`Account created! Please check your email to confirm your account.`, "info");
                    } else {
                        showNotification(`Welcome to Mangrove Watch, ${fullName}!`, "success");
                    }

                    setTimeout(() => {
                        showPage('home');
                    }, 1500);
                } else {
                    showNotification(result.error, "error");
                    submitBtn.innerHTML = originalHTML;
                    submitBtn.disabled = false;
                }
            } catch (err) {
                showNotification('Registration failed: ' + (err?.message || err), 'error');
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });
    }

    async function bindReportForm() {
        const form = document.getElementById("reportForm");
        if (!form) return;

        // Get location button handler
        const getLocationBtn = document.getElementById('getLocationBtn');
        if (getLocationBtn) {
            getLocationBtn.addEventListener('click', () => {
                if (navigator.geolocation) {
                    getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
                    getLocationBtn.disabled = true;
                    
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const latInput = document.getElementById('lat');
                            const lngInput = document.getElementById('lng');
                            latInput.value = position.coords.latitude.toFixed(6);
                            lngInput.value = position.coords.longitude.toFixed(6);
                            latInput.style.borderColor = 'var(--success)';
                            lngInput.style.borderColor = 'var(--success)';
                            
                            getLocationBtn.innerHTML = '<i class="fas fa-check"></i> Location Detected!';
                            getLocationBtn.style.background = 'var(--success)';
                            
                            showNotification('Location detected automatically!', 'success');
                            
                            setTimeout(() => {
                                getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i>Get Current Location';
                                getLocationBtn.disabled = false;
                                getLocationBtn.style.background = '';
                            }, 3000);
                        },
                        (error) => {
                            showNotification("Unable to get your location. Please enter manually.", "warning");
                            getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i>Get Current Location';
                            getLocationBtn.disabled = false;
                        }
                    );
                } else {
                    showNotification("Geolocation is not supported by this browser.", "error");
                }
            });
        }

        form.addEventListener("submit", async e => {
            e.preventDefault();
            
            if (typeof FirebaseService === 'undefined') {
                showNotification('Firebase not initialized. Please check your configuration.', 'error');
                return;
            }
            
            const user = FirebaseService.getCurrentUser();
            if (!user) {
                showNotification("Please login to submit a report.", "warning");
                showPage('user-login');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            
            // Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting Report...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            // Validate form data
            const incidentType = document.getElementById('incidentType').value;
            const description = document.getElementById('description').value.trim();
            const lat = parseFloat(document.getElementById('lat').value);
            const lng = parseFloat(document.getElementById('lng').value);
            const photoFile = document.getElementById('photo').files[0];

            if (!incidentType || !description || isNaN(lat) || isNaN(lng)) {
                showNotification("Please fill in all required fields correctly.", "error");
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                return;
            }

            const reportData = {
                incidentType,
                description,
                lat,
                lng
            };

            const result = await FirebaseService.submitReport(reportData, photoFile);
            
            if (result.success) {
                // Show success animation
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Report Submitted Successfully!';
                submitBtn.style.background = 'var(--success)';
                
                showNotification(`Thank you! Your report has been submitted successfully.`, "success");
                
                // Reset form
                form.reset();
                
                // Auto-navigate to reports page after 3 seconds
                setTimeout(() => {
                    showPage('myreports');
                }, 3000);
                
            } else {
                showNotification("Failed to submit report: " + result.error, "error");
            }
            
            // Reset button after delay
            setTimeout(() => {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.background = '';
            }, 4000);
        });
    }

    async function bindAuthorityLogin() {
        const form = document.getElementById("authorityLoginForm");
        if (!form) return;

        form.addEventListener("submit", async e => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;

            // Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
            submitBtn.disabled = true;

            try {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Check credentials (demo: admin@mangrovewatch.com / admin123)
                // In production, you'd verify this against an admin role in Firebase
                if (email === 'admin@mangrovewatch.com' && password === 'admin123') {
                    // Also login to Firebase for DB access
                    const result = await FirebaseService.loginUser(email, password);
                    
                    isAuthorityAuthenticated = true;
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Login Successful!';
                    submitBtn.style.background = 'var(--success)';
                    showNotification("Welcome to Authority Dashboard!", "success");
                    setTimeout(() => { showPage('authority'); }, 1500);
                
                } 
                else if (email === 'testadmin1@mangrovewatch.com' && password === 'admin1234') {
                    // Also login to Firebase for DB access
                    const result = await FirebaseService.loginUser(email, password);
                    
                    isAuthorityAuthenticated = true;
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Login Successful!';
                    submitBtn.style.background = 'var(--success)';
                    showNotification("Welcome to Authority Dashboard!", "success");
                    setTimeout(() => { showPage('authority'); }, 1500);
                }
                
                else 
                {
                    showNotification("Invalid credentials. Please check your email and password.", "error");
                    submitBtn.innerHTML = originalHTML;
                    submitBtn.disabled = false;
                }
            } catch (err) {
                showNotification('Authority login failed: ' + (err?.message || err), 'error');
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });
    }

    async function renderLeaderboard() {
        if (typeof FirebaseService === 'undefined') {
            showNotification('Firebase not initialized. Please check your configuration.', 'error');
            return;
        }

        try {
            const result = await FirebaseService.getLeaderboard();
            // Leaderboard should load even if result.success is false (permission denied for public view handled in config)
            if (!result.success && result.error !== 'permission-denied') {
                // Just log it, don't show user error if it's just permissions
                console.log("Leaderboard info:", result.error);
            }

            const leaderboard = result.leaderboard || [];
            const tbody = document.getElementById("leaderboardTable");
            if (!tbody) return;

            const badges = ['🥇', '🥈', '🥉', '🏅', '⭐', '⭐', '⭐', '⭐', '⭐', '⭐'];
            
            if (leaderboard.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                            <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                            No reports submitted yet. Be the first to report an incident!
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = leaderboard.map((user, index) => `
                    <tr style="animation: fadeInUp 0.5s ease ${index * 0.1}s both;">
                        <td><strong style="color: var(--primary);">#${index + 1}</strong></td>
                        <td><strong>${user.name}</strong></td>
                        <td>${user.reports}</td>
                        <td><strong style="color: var(--accent);">${user.points} pts</strong></td>
                        <td><span style="font-size: 1.5rem">${badges[index] || '⭐'}</span></td>
                    </tr>
                `).join("");
            }

            // Update leaderboard stats
            const stats = await FirebaseService.getReportStats();
            if (stats.success) {
                animateCounter('activeReporters', stats.stats.activeReporters);
                animateCounter('thisWeek', stats.stats.thisWeekReports);
                animateCounter('topScore', leaderboard[0]?.points || 0);
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    async function renderMyReports() {
        const container = document.getElementById("myReportsContainer");
        if (!container) return;

        if (typeof FirebaseService === 'undefined') return;

        const user = FirebaseService.getCurrentUser();
        if (!user) {
            container.innerHTML = `
                <div class="card">
                    <div style="text-align: center; padding: 2rem;">
                        <i class="fas fa-lock" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h3>Login Required</h3>
                        <p style="color: var(--text-muted); margin-bottom: 2rem;">Please login to view your submitted reports.</p>
                        <a href="#" class="btn btn-primary" onclick="showPage('user-login')">
                            <i class="fas fa-sign-in-alt"></i>Login
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        try {
            const result = await FirebaseService.getUserReports(user.uid);
            if (!result.success) {
                showNotification("Failed to load your reports: " + result.error, "error");
                return;
            }

            const reports = result.reports;
            
            if (reports.length === 0) {
                container.innerHTML = `
                    <div class="card">
                        <div style="text-align: center; padding: 2rem;">
                            <i class="fas fa-file-alt" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                            <h3>No Reports Yet</h3>
                            <p style="color: var(--text-muted); margin-bottom: 2rem;">You haven't submitted any reports yet. Help protect our mangroves by reporting incidents.</p>
                            <a href="#" class="btn btn-primary" onclick="showPage('report')">
                                <i class="fas fa-plus"></i>Submit First Report
                            </a>
                        </div>
                    </div>
                `;
                return;
            }

            // FIX: Added safe fallbacks for lat/lng to prevent crashes
            // FEATURE: Added Authority Name/Contact and Evidence Photo
            container.innerHTML = reports.map((r, index) => `
                <div class="card fade-in" style="margin-bottom: 2rem; animation-delay: ${index * 0.1}s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                        <div style="flex-grow: 1;">
                            <h3 style="margin: 0; color: var(--primary); font-size: 1.3rem;">${r.incidentType || 'Incident'}</h3>
                            <p style="margin: 0.75rem 0; color: var(--text-muted); font-size: 0.95rem;">
                                <i class="fas fa-calendar-alt"></i> ${formatDate(r.createdAt)} | 
                                <i class="fas fa-map-marker-alt"></i> ${Number(r.latitude || 0).toFixed(4)}, ${Number(r.longitude || 0).toFixed(4)}
                            </p>
                        </div>
                        <span class="status ${getStatusColor(r.status || 'pending')}">${(r.status || 'PENDING').toUpperCase()}</span>
                    </div>
                    <p style="margin-bottom: 1.5rem; line-height: 1.7; color: var(--text-muted);">${r.description || 'No description provided.'}</p>
                    
                    ${r.photoUrl ? `
                        <div style="margin-bottom: 1.5rem;">
                            <img src="${r.photoUrl}" alt="Report evidence" class="photo-thumbnail" onclick="showPhotoModal('${r.photoUrl}')" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid var(--primary);">
                        </div>
                    ` : ''}

                    ${r.authorityName ? `
                        <div style="margin-top:1rem; padding:1rem; background:rgba(255,255,255,0.05); border-radius:8px; border-left: 3px solid var(--accent);">
                            <small style="color:var(--text-muted); display:block; margin-bottom:0.5rem">HANDLED BY:</small>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="fas fa-user-shield" style="color:var(--accent)"></i>
                                <strong>${r.authorityName}</strong>
                                ${r.authorityContact ? `<span style="opacity:0.8; margin-left: 10px;"> <i class="fas fa-phone"></i> ${r.authorityContact}</span>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    ${r.status === 'resolved' && r.evidencePhotoUrl ? `
                        <div style="margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                            <strong style="color:var(--success)"><i class="fas fa-check-circle"></i> RESOLVED - EVIDENCE:</strong><br>
                            <img src="${r.evidencePhotoUrl}" style="width:100%; max-width:300px; border-radius:8px; margin-top:10px; border:2px solid var(--success); cursor:pointer" onclick="showPhotoModal('${r.evidencePhotoUrl}')">
                        </div>
                    ` : ''}

                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: var(--text-muted);">
                        <span>Report ID: <code style="background: var(--surface-dark); padding: 0.25rem 0.5rem; border-radius: 4px; color: var(--primary);">${(r.id || '').toString().slice(-6)}</code></span>
                        <span style="color: var(--primary);">+10 points earned</span>
                    </div>
                </div>
            `).join("");
        } catch (error) {
            console.error(error); // Log actual error
            showNotification('Failed to load reports: ' + error.message, 'error');
        }
    }

    async function renderAuthority() {
        // Check authentication
        if (!isAuthorityAuthenticated) {
            showPage('authority-login');
            return;
        }

        const tbody = document.getElementById("authorityTable");
        if (!tbody) return;

        if (typeof FirebaseService === 'undefined') {
            showNotification('Firebase not initialized. Please check your configuration.', 'error');
            return;
        }

        try {
            const result = await FirebaseService.getAllReports();
            if (!result.success) {
                showNotification("Failed to load reports: " + result.error, "error");
                return;
            }

            allReports = result.reports;
            const searchTerm = document.getElementById('searchReports')?.value.toLowerCase() || '';
            
            // FIX: Safe navigation for all properties during filter to prevent crash
            const filteredReports = allReports.filter(r => 
                (r.reporterName || '').toLowerCase().includes(searchTerm) ||
                (r.incidentType || '').toLowerCase().includes(searchTerm) ||
                (r.description || '').toLowerCase().includes(searchTerm) ||
                (r.id || '').toString().includes(searchTerm)
            );

            if (filteredReports.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                            <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                            ${allReports.length === 0 ? 'No reports to review at this time.' : 'No reports match your search criteria.'}
                        </td>
                    </tr>
                `;
                return;
            }

            // FIX: Added Number() cast for lat/lng
            // FEATURE: Added "Take Case" and "Resolve" buttons
            tbody.innerHTML = filteredReports.map((r, index) => `
                <tr style="animation: fadeInUp 0.3s ease ${index * 0.05}s both;">
                    <td><code style="background: var(--surface-dark); padding: 0.25rem 0.5rem; border-radius: 4px; color: var(--primary); font-size: 0.8rem;">${(r.id || '').toString().slice(-6)}</code></td>
                    <td><strong>${r.reporterName || 'Anonymous'}</strong><br><small style="color: var(--text-muted);">${r.reporterEmail || ''}</small></td>
                    <td>
                        <span style="color: var(--primary);">
                            <i class="fas fa-exclamation-triangle"></i> ${r.incidentType || 'Unknown'}
                        </span>
                    </td>
                    <td>
                        <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> 
                        ${Number(r.latitude || 0).toFixed(4)}, ${Number(r.longitude || 0).toFixed(4)}
                    </td>
                    <td style="font-size: 0.9rem;">${formatDate(r.createdAt)}</td>
                    <td><span class="status ${getStatusColor(r.status)}">${(r.status || 'pending').toUpperCase()}</span></td>
                    <td>
                        ${r.photoUrl ? `<img src="${r.photoUrl}" alt="Evidence" class="photo-thumbnail" onclick="showPhotoModal('${r.photoUrl}')">` : '<span style="color: var(--text-muted);">No photo</span>'}
                    </td>
                    <td>
                        ${r.status === 'pending' ? `
                            <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.8rem;" 
                                onclick="takeCase('${r.id}')">
                                <i class="fas fa-hand-paper"></i> Take Case
                            </button>
                        ` : ''}
                        ${r.status === 'investigating' ? `
                            <button class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.8rem;" 
                                onclick="openResolveModal('${r.id}')">
                                <i class="fas fa-check"></i> Resolve
                            </button>
                        ` : ''}
                        ${r.status === 'resolved' ? '<i class="fas fa-check-circle" style="color:var(--success)"></i> Done' : ''}
                    </td>
                </tr>
            `).join("");
        } catch (error) {
            console.error(error);
            showNotification('Failed to load authority reports: ' + error.message, 'error');
        }
    }

    // Global functions
    
    // --- NEW: Take Case Function ---
    window.takeCase = async (reportId) => {
        const contact = prompt("Please enter your official contact number/email so the user can contact you:");
        if (!contact) return;
        
        const user = FirebaseService.getCurrentUser();
        // Fallback name if admin isn't properly profiled
        const adminName = user ? (user.displayName || 'Authority Admin') : 'Authority Admin';

        const result = await FirebaseService.assignAuthority(reportId, adminName, contact);
        if (result.success) {
            showNotification("Case assigned to you successfully!", "success");
            renderAuthority();
            updateStats();
        } else {
            showNotification("Error assigning case: " + result.error, "error");
        }
    };

    // --- NEW: Open Resolve Modal ---
    window.openResolveModal = (reportId) => {
        document.getElementById('resolveReportId').value = reportId;
        const modal = document.getElementById('resolveModal');
        modal.classList.add('active');
        // Force visibility in case CSS transition is tricky
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
    };

    // --- FIX: Close Modal Function ---
    // This specifically removes the inline styles that were keeping the popup open
    window.closeResolveModal = () => {
        const modal = document.getElementById('resolveModal');
        modal.classList.remove('active');
        modal.style.visibility = ''; // Clears the inline style
        modal.style.opacity = '';    // Clears the inline style
    };

    // --- NEW: Submit Resolution ---
    window.submitResolution = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('resolveSubmitBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Uploading...';
        btn.disabled = true;

        const reportId = document.getElementById('resolveReportId').value;
        const file = document.getElementById('resolveEvidence').files[0];

        if (!file) {
            alert("Please upload photo evidence.");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const res = await FirebaseService.resolveReport(reportId, file);
        if (res.success) {
            showNotification("Report resolved successfully!", "success");
            // Call the fixed close function
            window.closeResolveModal();
            renderAuthority();
            updateStats();
        } else {
            showNotification("Error: " + res.error, "error");
        }
        
        btn.innerHTML = originalText;
        btn.disabled = false;
    };

    window.updateReportStatus = async (reportId, newStatus) => {
        if (typeof FirebaseService === 'undefined') {
            showNotification('Firebase not initialized', 'error');
            return;
        }

        const result = await FirebaseService.updateReportStatus(reportId, newStatus);
        if (result.success) {
            await renderAuthority();
            await updateStats();
            showNotification(
                `Report status updated to ${newStatus}`, 
                'success'
            );
        } else {
            showNotification("Failed to update report status: " + result.error, "error");
        }
    };

    window.filterReports = () => {
        renderAuthority();
    };

    window.togglePassword = () => {
        const passwordInput = document.getElementById('authPassword');
        const passwordIcon = document.getElementById('passwordIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordIcon.classList.remove('fa-eye');
            passwordIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            passwordIcon.classList.remove('fa-eye-slash');
            passwordIcon.classList.add('fa-eye');
        }
    };

    window.toggleUserPassword = () => {
        const passwordInput = document.getElementById('userPassword');
        const passwordIcon = document.getElementById('userPasswordIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordIcon.classList.remove('fa-eye');
            passwordIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            passwordIcon.classList.remove('fa-eye-slash');
            passwordIcon.classList.add('fa-eye');
        }
    };

    window.toggleRegPassword = () => {
        const passwordInput = document.getElementById('regPassword');
        const passwordIcon = document.getElementById('regPasswordIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordIcon.classList.remove('fa-eye');
            passwordIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            passwordIcon.classList.remove('fa-eye-slash');
            passwordIcon.classList.add('fa-eye');
        }
    };

    window.logout = () => {
        isAuthorityAuthenticated = false;
        showNotification("You have been logged out successfully.", "info");
        showPage('authority-login');
    };

    window.userLogout = async () => {
        if (typeof FirebaseService === 'undefined') {
            showNotification('Firebase not initialized', 'error');
            return;
        }

        const result = await FirebaseService.logoutUser();
        if (result.success) {
            showNotification("You have been logged out successfully.", "info");
            showPage('home');
        } else {
            showNotification("Error logging out: " + result.error, "error");
        }
    };

    window.checkAuthAndNavigate = async (page) => {
        try {
            if (typeof FirebaseService === 'undefined') {
                showNotification("Please check your Firebase configuration.", "warning");
                return;
            }

            const user = FirebaseService.getCurrentUser();
            if (!user) {
                showNotification("Please login to access this feature.", "warning");
                showPage('user-login');
            } else {
                showPage(page);
            }
        } catch (error) {
            showNotification("Please login to access this feature.", "warning");
            showPage('user-login');
        }
    };

    window.showPhotoModal = (photoURL) => {
        const modal = document.createElement('div');
        modal.className = 'photo-modal';
        modal.innerHTML = `
            <img src="${photoURL}" alt="Report evidence">
            <button class="photo-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 100);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    };

    // FIXED NOTIFICATION FUNCTION
    function showNotification(message, type = 'info') {
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = 'notification';
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const colors = {
            success: 'var(--success)',
            error: 'var(--danger)',
            warning: 'var(--warning)',
            info: 'var(--primary)'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1.5rem 2rem;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 99999;
            transform: translateX(400px);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            max-width: 400px;
            min-width: 300px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 15px;
        `;
        
        const iconHtml = `<i class="fas ${icons[type] || icons.info}" style="font-size: 1.2rem;"></i>`;
        const msgSpan = document.createElement('span');
        msgSpan.textContent = message;
        msgSpan.style.flexGrow = '1';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = `background:none;border:none;color:white;font-size:1.2rem;cursor:pointer;padding:5px;opacity:0.8;`;
        
        closeBtn.onclick = function() {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 400);
        };

        notification.innerHTML = iconHtml;
        notification.appendChild(msgSpan);
        notification.appendChild(closeBtn);
        
        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.style.transform = 'translateX(0)');
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => { if (document.body.contains(notification)) notification.remove(); }, 400);
            }
        }, 5000);
    }

    function initializeLoader() {
        const loader = document.getElementById('loader');
        if (!loader) return;

        const loadingTexts = [
            'Initializing community reporting platform...',
            'Connecting to Firebase...',
            'Loading incident reports...',
            'Preparing dashboard...',
            'Almost ready!'
        ];

        let textIndex = 0;
        const loadingTextEl = document.querySelector('.loading-text');
        
        const textInterval = setInterval(() => {
            if (textIndex < loadingTexts.length - 1) {
                textIndex++;
                if (loadingTextEl) {
                    loadingTextEl.style.opacity = '0';
                    setTimeout(() => {
                        loadingTextEl.textContent = loadingTexts[textIndex];
                        loadingTextEl.style.opacity = '1';
                    }, 200);
                }
            }
        }, 600);

        setTimeout(() => {
            clearInterval(textInterval);
            loader.style.opacity = '0';
            loader.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                loader.style.display = 'none';
            }, 800);
        }, 3500);
    }

    function startStatsRefresh() {
        if (statsRefreshInterval) clearInterval(statsRefreshInterval);
        statsRefreshInterval = setInterval(() => {
            if (window.location.hash !== '#offline') updateStats();
        }, 30000);
    }

    function stopStatsRefresh() {
        if (statsRefreshInterval) {
            clearInterval(statsRefreshInterval);
            statsRefreshInterval = null;
        }
    }

    function onReady() {
        if (typeof FirebaseService === 'undefined') {
            showNotification('Firebase configuration not loaded. Please check config.js', 'error');
            return;
        }

        bindReportForm();
        bindAuthorityLogin();
        bindUserLogin();
        bindUserRegister();
        renderLeaderboard();
        renderMyReports();
        updateStats();
        initializeLoader();
        startStatsRefresh();
        
        document.getElementById("year").textContent = new Date().getFullYear();
    }

    document.addEventListener("DOMContentLoaded", onReady);

    return { 
        renderAuthority, 
        renderLeaderboard, 
        renderMyReports, 
        showNotification,
        updateStats,
        stopStatsRefresh
    };
})();

// Enhanced Navigation System
const Navigation = (() => {
    let currentPage = 'home';

    function showPage(pageName) {
        document.querySelectorAll('.page').forEach(page => {
            page.style.opacity = '0';
            page.style.transform = 'translateY(20px)';
            setTimeout(() => {
                page.classList.add('hidden');
            }, 300);
        });

        setTimeout(() => {
            const targetPage = document.getElementById(`${pageName}-page`);
            if (targetPage) {
                targetPage.classList.remove('hidden');
                setTimeout(() => {
                    targetPage.style.opacity = '1';
                    targetPage.style.transform = 'translateY(0)';
                    targetPage.classList.add('fade-in');
                }, 50);
            }

            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                link.style.transform = '';
            });
            
            const activeLink = document.querySelector(`[data-page="${pageName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
                activeLink.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    activeLink.style.transform = '';
                }, 200);
            }

            switch(pageName) {
                case 'leaderboard':
                    MW.renderLeaderboard();
                    break;
                case 'myreports':
                    MW.renderMyReports();
                    break;
                case 'authority':
                    MW.renderAuthority();
                    break;
                case 'authority-login':
                case 'user-login':
                case 'user-register':
                    setTimeout(() => {
                        const formId = pageName === 'authority-login' ? 'authorityLoginForm' :
                                      pageName === 'user-login' ? 'userLoginForm' : 'userRegisterForm';
                        const form = document.getElementById(formId);
                        if (form) form.reset();
                    }, 100);
                    break;
            }

            currentPage = pageName;
            closeMobileMenu();
        }, 300);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function toggleMobileMenu() {
        const navMenu = document.getElementById('navMenu');
        const mobileToggle = document.getElementById('mobileToggle');
        const icon = mobileToggle.querySelector('i');
        
        navMenu.classList.toggle('active');
        
        if (navMenu.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
            icon.style.transform = 'rotate(180deg)';
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
            icon.style.transform = 'rotate(0deg)';
        }
    }

    function closeMobileMenu() {
        const navMenu = document.getElementById('navMenu');
        const mobileToggle = document.getElementById('mobileToggle');
        if (!navMenu || !mobileToggle) return;
        
        const icon = mobileToggle.querySelector('i');
        
        navMenu.classList.remove('active');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
        icon.style.transform = 'rotate(0deg)';
    }

    document.addEventListener('DOMContentLoaded', () => {
        const mobileToggle = document.getElementById('mobileToggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', toggleMobileMenu);
        }

        document.addEventListener('click', (e) => {
            const navMenu = document.getElementById('navMenu');
            const mobileToggle = document.getElementById('mobileToggle');
            
            if (navMenu && mobileToggle && 
                !navMenu.contains(e.target) && 
                !mobileToggle.contains(e.target)) {
                closeMobileMenu();
            }
        });

        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.4);
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                    width: ${size}px;
                    height: ${size}px;
                    left: ${x}px;
                    top: ${y}px;
                    pointer-events: none;
                `;
                
                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });

        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    });

    return { showPage, closeMobileMenu };
})();

window.showPage = Navigation.showPage;

document.addEventListener('keydown', (e) => {
    if (e.altKey) {
        e.preventDefault();
        try {
            switch(e.key) {
                case '1': showPage('home'); break;
                case '2': checkAuthAndNavigate('report'); break;
                case '3': showPage('leaderboard'); break;
                case '4': checkAuthAndNavigate('myreports'); break;
                case '5': showPage('authority-login'); break;
                case '6': showPage('user-login'); break;
            }
        } catch (error) {
            console.error('Keyboard navigation failed:', error);
        }
    }
    
    if (e.key === 'Escape') {
        const navMenu = document.getElementById('navMenu');
        if (navMenu && navMenu.classList.contains('active')) Navigation.closeMobileMenu();
        const photoModal = document.querySelector('.photo-modal');
        if (photoModal) photoModal.remove();
        // Close Resolve Modal if open
        const resolveModal = document.getElementById('resolveModal');
        if (resolveModal && resolveModal.classList.contains('active')) window.closeResolveModal();
    }
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('animate-in');
    });
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card, .stat-card').forEach(el => observer.observe(el));
});
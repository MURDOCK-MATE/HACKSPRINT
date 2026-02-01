// ⚠️ SECURITY WARNING: These credentials should NEVER be committed to public repositories
// Add this file to .gitignore before pushing to GitHub

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6i0uGo5Efg6AKbQ9s8W-Yc9wM1Ggcj0I",
  authDomain: "mangrove-watch-a65e4.firebaseapp.com",
  projectId: "mangrove-watch-a65e4",
  storageBucket: "mangrove-watch-a65e4.firebasestorage.app",
  messagingSenderId: "10784769729",
  appId: "1:10784769729:web:8b29569402c3c7049b7640",
  measurementId: "G-LK4ZTXRZ3X"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Debug mode - set to false in production
const DEBUG = false;

// Helper to safely handle Firestore timestamps
const safeTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toISOString();
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    // Handle cases where it might already be a string or Date object
    return new Date(timestamp).toISOString();
};

// Firebase Helper Functions
const FirebaseService = {
    // User Authentication
    async registerUser(email, password, fullName, phone = '') {
        try {
            if (DEBUG) console.log('Starting registration for:', email);

            // Register user with Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update display name
            await user.updateProfile({
                displayName: fullName
            });

            // Create user profile in Firestore
            await db.collection('users').doc(user.uid).set({
                fullName: fullName,
                email: email,
                phone: phone || null,
                totalReports: 0,
                points: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                user: user,
                needsEmailConfirmation: !user.emailVerified
            };
        } catch (error) {
            if (DEBUG) console.error('Registration error:', error);
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') errorMessage = 'An account with this email already exists.';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Please enter a valid email address.';
            else if (error.code === 'auth/weak-password') errorMessage = 'Password must be at least 6 characters long.';

            return { success: false, error: errorMessage };
        }
    },

    async loginUser(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            let errorMessage = error.message;
            if (error.code === 'auth/user-not-found') errorMessage = 'No account found with this email.';
            else if (error.code === 'auth/wrong-password') errorMessage = 'Incorrect password.';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Invalid email address.';
            return { success: false, error: errorMessage };
        }
    },

    async logoutUser() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getCurrentUser() {
        return auth.currentUser;
    },

    // Report Management
    async submitReport(reportData, photoFile = null) {
        try {
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Get user profile for reporter name
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userProfile = userDoc.data() || {};

            let photoURL = null;

            // Upload photo if provided
            if (photoFile) {
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${photoFile.name}`;
                const storageRef = storage.ref(`reports/${fileName}`);
                
                const uploadTask = await storageRef.put(photoFile);
                photoURL = await uploadTask.ref.getDownloadURL();
            }

            // Create report document
            const reportDoc = {
                userId: user.uid,
                reporterName: userProfile.fullName || user.displayName || 'Anonymous',
                reporterEmail: user.email,
                incidentType: reportData.incidentType,
                description: reportData.description,
                latitude: Number(reportData.lat), // Ensure number
                longitude: Number(reportData.lng), // Ensure number
                photoUrl: photoURL,
                status: 'pending',
                // New fields for Authority tracking
                authorityId: null,
                authorityName: null,
                authorityContact: null,
                evidencePhotoUrl: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add report to Firestore
            const reportRef = await db.collection('reports').add(reportDoc);

// mark for AI dispatch
await db.collection("reports").doc(reportRef.id).update({
  aiPending: true
});


            // Update user stats
            await db.collection('users').doc(user.uid).update({
                totalReports: firebase.firestore.FieldValue.increment(1),
                points: firebase.firestore.FieldValue.increment(10)
            });

            return { success: true, reportId: reportRef.id };
        } catch (error) {
            if (DEBUG) console.error('Submit report error:', error);
            return { success: false, error: error.message };
        }
    },

    // --- NEW: Assign Authority (Take Case) ---
    async assignAuthority(reportId, authorityName, authorityContact) {
        try {
            const user = this.getCurrentUser();
            // Note: In a real app, you'd check if user is actually an admin here via ID token claims
            // For this demo, we assume the UI handles the "isAuthorityAuthenticated" check
            
            await db.collection('reports').doc(reportId).update({
                status: 'investigating',
                authorityId: user ? user.uid : 'admin',
                authorityName: authorityName,
                authorityContact: authorityContact,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // --- NEW: Resolve with Evidence ---
    async resolveReport(reportId, evidenceFile) {
        try {
            let evidenceURL = null;

            if (evidenceFile) {
                const fileName = `evidence/${reportId}_${Date.now()}_${evidenceFile.name}`;
                const storageRef = storage.ref(fileName);
                const uploadTask = await storageRef.put(evidenceFile);
                evidenceURL = await uploadTask.ref.getDownloadURL();
            }

            await db.collection('reports').doc(reportId).update({
                status: 'resolved',
                evidencePhotoUrl: evidenceURL,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getUserReports(userId) {
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const reports = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: safeTimestamp(data.createdAt)
                };
            });

            return { success: true, reports };
        } catch (error) {
            // Fallback: If index is missing for where+orderBy, try client-side sort
            if (error.code === 'failed-precondition') {
                console.warn('Missing index, falling back to client-side sort');
                const snapshot = await db.collection('reports').where('userId', '==', userId).get();
                const reports = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: safeTimestamp(doc.data().createdAt)
                })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                return { success: true, reports };
            }
            if (DEBUG) console.error('Get user reports error:', error);
            return { success: false, error: error.message };
        }
    },

    async getAllReports() {
        try {
            const snapshot = await db.collection('reports')
                .orderBy('createdAt', 'desc')
                .get();

            const reports = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: safeTimestamp(data.createdAt)
                };
            });

            return { success: true, reports };
        } catch (error) {
            if (DEBUG) console.error('Get all reports error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateReportStatus(reportId, newStatus) {
        try {
            await db.collection('reports').doc(reportId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getLeaderboard() {
        try {
            const snapshot = await db.collection('users')
                .orderBy('points', 'desc')
                .limit(10)
                .get();

            const leaderboard = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.fullName || data.email || 'Anonymous',
                    reports: data.totalReports || 0,
                    points: data.points || 0
                };
            });

            return { success: true, leaderboard };
        } catch (error) {
             // FIX: If permission denied (not logged in), return empty list instead of error
            if(error.code === 'permission-denied') return { success: true, leaderboard: [] };
            if (DEBUG) console.error('Get leaderboard error:', error);
            return { success: false, error: error.message };
        }
    },

    async getReportStats() {
        try {
            const reportsSnapshot = await db.collection('reports').get();
            const reports = reportsSnapshot.docs.map(doc => doc.data());

            const usersSnapshot = await db.collection('users').get();
            const totalUsers = usersSnapshot.size;

            let totalReports = reports.length;
            let pendingReports = 0;
            let investigatingReports = 0;
            let resolvedReports = 0;
            let thisWeekReports = 0;

            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            reports.forEach(report => {
                const status = report.status || 'pending';
                if (status === 'pending') pendingReports++;
                else if (status === 'investigating') investigatingReports++;
                else if (status === 'resolved') resolvedReports++;

                // Safe date check for stats
                let reportDate;
                if (report.createdAt && typeof report.createdAt.toDate === 'function') {
                    reportDate = report.createdAt.toDate();
                } else if (report.createdAt) {
                    reportDate = new Date(report.createdAt);
                }

                if (reportDate && reportDate > oneWeekAgo) thisWeekReports++;
            });

            const resolvedPercentage = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

            return {
                success: true,
                stats: {
                    totalReports,
                    pendingReports,
                    investigatingReports,
                    resolvedReports,
                    resolvedPercentage,
                    activeReporters: totalUsers,
                    thisWeekReports
                }
            };
        } catch (error) {
            if (DEBUG) console.error('Get report stats error:', error);
            return { success: false, error: error.message };
        }
    },

    async getUserProfile(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (!doc.exists) return { success: false, error: 'User profile not found' };
            return { success: true, profile: doc.data() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Auth state observer
auth.onAuthStateChanged((user) => {
    updateUIForAuthState(user);
});

function updateUIForAuthState(user) {
    const loginNavItem = document.getElementById('loginNavItem');
    const logoutNavItem = document.getElementById('logoutNavItem');
    const reportNavItem = document.getElementById('reportNavItem');
    const leaderboardNavItem = document.getElementById('leaderboardNavItem');
    const myReportsNavItem = document.getElementById('myReportsNavItem');

    if (user) {
        if (loginNavItem) loginNavItem.style.display = 'none';
        if (logoutNavItem) logoutNavItem.style.display = 'block';
        if (reportNavItem) reportNavItem.style.display = 'block';
        if (leaderboardNavItem) leaderboardNavItem.style.display = 'block';
        if (myReportsNavItem) myReportsNavItem.style.display = 'block';

        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) {
            FirebaseService.getUserProfile(user.uid).then(result => {
                if (result.success) {
                    welcomeMsg.textContent = `Welcome back, ${result.profile.fullName || 'Community Reporter'}!`;
                    welcomeMsg.style.display = 'block';
                }
            });
        }
    } else {
        if (loginNavItem) loginNavItem.style.display = 'block';
        if (logoutNavItem) logoutNavItem.style.display = 'none';
        if (reportNavItem) reportNavItem.style.display = 'none';
        if (leaderboardNavItem) leaderboardNavItem.style.display = 'none';
        if (myReportsNavItem) myReportsNavItem.style.display = 'none';

        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) welcomeMsg.style.display = 'none';
    }
}
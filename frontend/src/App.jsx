import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import {
  BriefcaseBusiness,
  LayoutDashboard,
  CalendarDays,
  Settings,
  TrendingUp,
  Plus,
  Search,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  X,
  Clock,
  Trash2,
  Pencil,
  Filter,
  RefreshCw,
  UserRound,
  Save,
  Upload,
  Download,
} from "lucide-react";
import "./App.css";

const API_URL =
  "https://a2ovi23axz7o7ebqjsfy5z2emu0ukeyy.lambda-url.ap-southeast-2.on.aws";


async function apiFetch(auth, url, options = {}) {
  // Never send protected API requests without a Cognito access token.
  const token = auth.user?.access_token;

  if (!auth.isAuthenticated || !token) {
    throw new Error("Cognito access token unavailable. Please sign in again.");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

const STATUSES = [
  "Saved",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
];

const STATUS_COLORS = {
  Saved: "#64748b",
  Applied: "#6366f1",
  Assessment: "#f59e0b",
  Interview: "#0ea5e9",
  Offer: "#10b981",
  Rejected: "#ef4444",
};

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("saved")) return "Saved";
  if (value.includes("assessment")) return "Assessment";
  if (value.includes("interview")) return "Interview";
  if (value.includes("offer") || value.includes("selected")) return "Offer";
  if (value.includes("reject")) return "Rejected";

  return "Applied";
}

function App() {
  const auth = useAuth();
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState("Dashboard");

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeDownloading, setResumeDownloading] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeError, setResumeError] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    preferred_roles: "Software Engineer, Backend Developer, Python Developer",
    preferred_locations: "Hyderabad, Remote",
    linkedin: "",
    github: "",
    portfolio: "",
    resume_url: "",
    skills: [],
  });

  const [formData, setFormData] = useState({
    company: "",
    role: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    status: "Applied",
    job_url: "",
    interview_date: "",
    interview_time: "",
  });

  async function fetchApplications() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(auth, `${API_URL}/applications`);

      if (!response.ok) {
        throw new Error(`Request failed: HTTP ${response.status}`);
      }

      const data = await response.json();

      const normalized = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        id: item.application_id || item.id,
        company: item.company || "Unknown company",
        role: item.role || item.title || "Unknown role",
        location: item.location || "",
        date:
          item.date ||
          item.created_at?.slice(0, 10) ||
          item.saved_at?.slice(0, 10) ||
          "",
        status: normalizeStatus(item.status),
        job_url: item.job_url || item.url || "",
        interview_date: item.interview_date || "",
        interview_time: item.interview_time || "",
      }));

      setApplications(normalized);
    } catch (err) {
      console.error("ApplyTrack API request failed:", err);

      setError(
        `Could not load applications: ${err.message || "Network error"}.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // AuthProvider may initially be loading. Fetch only after login is complete.
    if (auth.isLoading) return;

    if (auth.isAuthenticated && auth.user?.access_token) {
      fetchApplications();
    } else if (!auth.isAuthenticated) {
      setApplications([]);
      setLoading(false);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user?.access_token]);

  async function loadProfile() {
    try {
      setProfileLoading(true);
      setProfileError("");
      setProfileMessage("");

      const response = await apiFetch(auth, `${API_URL}/profile`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load profile");
      }

      if (result && !result.message) {
        setProfile((previous) => ({
          ...previous,
          ...result,
          skills: Array.isArray(result.skills)
            ? result.skills
            : typeof result.skills === "string"
              ? result.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
              : previous.skills || [],
        }));
      }
    } catch (err) {
      setProfileError(err.message || "Could not load profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    try {
      setProfileSaving(true);
      setProfileMessage("");
      setProfileError("");

      const response = await apiFetch(auth, `${API_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save profile");
      }

      if (result.profile) {
        setProfile((previous) => ({
          ...previous,
          ...result.profile,
        }));
      }

      setProfileMessage("Profile saved successfully.");
    } catch (err) {
      setProfileError(err.message || "Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  function updateProfileField(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function addSkill() {
    const skill = newSkill.trim();
    if (!skill) return;

    setProfile((previous) => {
      const currentSkills = Array.isArray(previous.skills) ? previous.skills : [];
      if (currentSkills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
        return previous;
      }

      return { ...previous, skills: [...currentSkills, skill] };
    });

    setNewSkill("");
  }

  function removeSkill(skillToRemove) {
    setProfile((previous) => ({
      ...previous,
      skills: (Array.isArray(previous.skills) ? previous.skills : []).filter(
        (skill) => skill !== skillToRemove
      ),
    }));
  }

  async function uploadResume(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setResumeError("Please select a PDF, DOC, or DOCX file.");
      setResumeMessage("");
      return;
    }

    try {
      setResumeUploading(true);
      setResumeError("");
      setResumeMessage("");

      // Request a short-lived S3 upload URL from Lambda.
      const urlResponse = await apiFetch(auth, `${API_URL}/resume/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
        }),
      });

      const urlResult = await urlResponse.json();

      if (!urlResponse.ok || !urlResult.upload_url || !urlResult.resume_key) {
        throw new Error(urlResult.error || "Could not create resume upload URL.");
      }

      // Upload the file directly to the private S3 bucket.
      const s3Response = await fetch(urlResult.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!s3Response.ok) {
        throw new Error(`S3 upload failed (HTTP ${s3Response.status}).`);
      }

      // Store the S3 object key in the user's DynamoDB profile.
      const updatedProfile = {
        ...profile,
        resume_key: urlResult.resume_key,
        resume_file_name: file.name,
      };

      const profileResponse = await apiFetch(auth, `${API_URL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProfile),
      });

      const profileResult = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profileResult.error || "Uploaded resume, but could not save it to your profile.");
      }

      setProfile((previous) => ({
        ...previous,
        ...(profileResult.profile || updatedProfile),
      }));

      setResumeMessage(`Resume uploaded successfully: ${file.name}`);
    } catch (err) {
      console.error("Resume upload error:", err);
      setResumeError(err.message || "Resume upload failed.");
    } finally {
      setResumeUploading(false);
    }
  }

  async function downloadResume() {
    if (!profile.resume_key) {
      setResumeError("No uploaded resume is saved in your profile yet.");
      return;
    }

    try {
      setResumeDownloading(true);
      setResumeError("");
      setResumeMessage("");

      const response = await apiFetch(auth, `${API_URL}/resume/download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_key: profile.resume_key }),
      });

      const result = await response.json();

      if (!response.ok || !result.download_url) {
        throw new Error(result.error || "Could not create resume download URL.");
      }

      window.open(result.download_url, "_blank", "noopener,noreferrer");
      setResumeMessage("Secure resume download link opened.");
    } catch (err) {
      console.error("Resume download error:", err);
      setResumeError(err.message || "Resume download failed.");
    } finally {
      setResumeDownloading(false);
    }
  }

  function navigateTo(page) {
    setCurrentPage(page);

    if (page === "Interviews") {
      setSelectedStatus("Interview");
    } else if (page === "Applications" || page === "Dashboard") {
      setSelectedStatus("All");
    } else if (page === "Settings") {
      loadProfile();
    }
  }

  const totalApplications = applications.length;

  const statusCounts = STATUSES.reduce((counts, status) => {
    counts[status] = applications.filter(
      (application) => application.status === status
    ).length;

    return counts;
  }, {});

  const interviewCount = statusCounts.Interview || 0;
  const offerCount = statusCounts.Offer || 0;

  const responseRate =
    totalApplications > 0
      ? Math.round(
          ((interviewCount + offerCount) / totalApplications) * 100
        )
      : 0;

  const filteredApplications = applications.filter((application) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      application.company?.toLowerCase().includes(searchText) ||
      application.role?.toLowerCase().includes(searchText) ||
      application.status?.toLowerCase().includes(searchText) ||
      application.location?.toLowerCase().includes(searchText);

    const matchesStatus =
      selectedStatus === "All" ||
      application.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  function openAddForm() {
    setEditingId(null);

    setFormData({
      company: "",
      role: "",
      location: "",
      date: new Date().toISOString().split("T")[0],
      status: "Applied",
      job_url: "",
      interview_date: "",
      interview_time: "",
    });

    setShowForm(true);
  }

  function openEditForm(application) {
    setEditingId(application.id);

    setFormData({
      company: application.company || "",
      role: application.role || "",
      location: application.location || "",
      date: application.date || new Date().toISOString().split("T")[0],
      status: application.status || "Applied",
      job_url: application.job_url || "",
      interview_date: application.interview_date || "",
      interview_time: application.interview_time || "",
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.company.trim() || !formData.role.trim()) {
      alert("Please enter both company name and job role.");
      return;
    }

    if (
      normalizeStatus(formData.status) === "Interview" &&
      (!formData.interview_date || !formData.interview_time)
    ) {
      alert("Please enter the interview date and time.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = editingId
        ? { ...formData, application_id: editingId }
        : { ...formData };

      const response = await apiFetch(auth, `${API_URL}/applications`, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.detail || "Unable to save application"
        );
      }

      closeForm();
      await fetchApplications();
    } catch (err) {
      alert(err.message || "Could not save application.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatusChange(application, newStatus) {
    if (application.status === newStatus) return;

    try {
      setError("");

      const response = await apiFetch(auth, `${API_URL}/applications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          application_id: application.id,
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.detail || "Unable to update application status"
        );
      }

      await fetchApplications();
    } catch (err) {
      alert(err.message || "Could not update application status.");
    }
  }

  async function handleDelete(application) {
    const confirmed = window.confirm(
      `Delete ${application.company} — ${application.role}?`
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(auth, `${API_URL}/applications`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          application_id: application.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete application");
      }

      await fetchApplications();
    } catch (err) {
      alert(err.message || "Could not delete application.");
    }
  }

  function getStatusClass(status) {
    const normalized = status?.toLowerCase() || "";

    if (normalized.includes("interview")) return "interview";
    if (normalized.includes("assessment")) return "assessment";
    if (normalized.includes("offer") || normalized.includes("selected"))
      return "offer";
    if (normalized.includes("reject")) return "rejected";
    if (normalized.includes("saved")) return "saved";

    return "applied";
  }

  function selectPipelineStatus(status) {
    setSelectedStatus((previous) =>
      previous === status ? "All" : status
    );

    setCurrentPage("Applications");

    document.getElementById("applications")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const upcomingInterviews = applications
    .filter(
      (application) =>
        normalizeStatus(application.status) === "Interview" &&
        application.interview_date
    )
    .sort((a, b) => {
      const dateA = `${a.interview_date} ${a.interview_time || "00:00"}`;
      const dateB = `${b.interview_date} ${b.interview_time || "00:00"}`;
      return dateA.localeCompare(dateB);
    });

  function formatInterviewDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatInterviewTime(timeString) {
    if (!timeString) return "Time not set";
    const [hours, minutes] = timeString.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const initials = (profile.name || "AB")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (auth.isLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>Checking your sign-in...</div>;
  }

  if (auth.error) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", textAlign: "center", padding: 24 }}><div><h2>Sign-in error</h2><p>{auth.error.message}</p><button onClick={() => auth.signinRedirect()}>Try signing in again</button></div></div>;
  }

  if (!auth.isAuthenticated) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", background: "#f8fafc" }}><div style={{ textAlign: "center", padding: 32, background: "white", borderRadius: 16, boxShadow: "0 10px 30px #0001" }}><h1>ApplyTrack</h1><p>Sign in to manage your job applications.</p><button onClick={() => auth.signinRedirect()} style={{ padding: "12px 24px", border: 0, borderRadius: 8, background: "#4f46e5", color: "white", cursor: "pointer" }}>Sign in / Create account</button></div></div>;
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <BriefcaseBusiness size={24} />
          </div>
          <span>ApplyTrack</span>
        </div>

        <div className="menu-label">MENU</div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${
              currentPage === "Dashboard" ? "active" : ""
            }`}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
            }}
            onClick={() => navigateTo("Dashboard")}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              currentPage === "Applications" ? "active" : ""
            }`}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
            }}
            onClick={() => navigateTo("Applications")}
          >
            <BriefcaseBusiness size={19} />
            <span>Applications</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              currentPage === "Interviews" ? "active" : ""
            }`}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
            }}
            onClick={() => navigateTo("Interviews")}
          >
            <CalendarDays size={19} />
            <span>Interviews</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              currentPage === "Settings" ? "active" : ""
            }`}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
            }}
            onClick={() => navigateTo("Settings")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="motivation-card">
            <TrendingUp size={22} />
            <h4>Stay on track</h4>
            <p>
              Stay organized, follow your progress, and focus on your next
              opportunity.
            </p>
          </div>

          <button
            type="button"
            className="profile"
            onClick={() => navigateTo("Settings")}
            style={{
              background: "transparent",
              border: 0,
              textAlign: "left",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <div className="avatar">{initials}</div>
            <div>
              <strong>{profile.name || "Your Name"}</strong>
              <p>Job Seeker</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{currentPage}</strong>
          </div>

          <div className="topbar-profile">
            <button type="button" onClick={async () => {
  const cognitoDomain =
    "https://ap-southeast-2bgvpkc2wn.auth.ap-southeast-2.amazoncognito.com";

  const clientId = "3ih97oi4d9h56r2o89kn078fdc";

  const logoutUri = window.location.origin;

  await auth.removeUser();

  window.location.href =
    `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
}} style={{ border: 0, background: "transparent", cursor: "pointer" }}>Sign out</button>
            <Bell size={20} />
            <div className="avatar small">{initials}</div>
          </div>
        </header>

        <div className="dashboard-content">
          {currentPage === "Settings" ? (
            <section
              className="applications-card"
              style={{ padding: "28px" }}
            >
              <div className="section-header">
                <div>
                  <span className="eyebrow">PERSONAL WORKSPACE</span>
                  <h3 style={{ marginTop: "8px" }}>My Profile</h3>
                  <p>
                    Manage your contact details, career preferences, and
                    professional links.
                  </p>
                </div>

                <div className="stat-icon purple">
                  <UserRound size={22} />
                </div>
              </div>

              {profileLoading && <p>Loading profile...</p>}

              {profileError && (
                <div className="error-message">{profileError}</div>
              )}

              {profileMessage && (
                <p style={{ color: "#059669", fontWeight: 600 }}>
                  {profileMessage}
                </p>
              )}

              <form
                onSubmit={saveProfile}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                  marginTop: "24px",
                }}
              >
                {[
                  ["name", "Full Name", "Your full name"],
                  ["email", "Email Address", "name@example.com"],
                  ["phone", "Phone Number", "Optional phone number"],
                  [
                    "preferred_roles",
                    "Preferred Job Roles",
                    "Software Engineer, Backend Developer",
                  ],
                  [
                    "preferred_locations",
                    "Preferred Locations",
                    "Hyderabad, Remote",
                  ],
                  ["linkedin", "LinkedIn URL", "https://linkedin.com/in/..."],
                  ["github", "GitHub URL", "https://github.com/..."],
                  ["portfolio", "Portfolio URL", "https://yourportfolio.com"],
                ].map(([name, label, placeholder]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <label
                      htmlFor={`profile-${name}`}
                      style={{ fontWeight: 600, fontSize: "14px" }}
                    >
                      {label}
                    </label>

                    <input
                      id={`profile-${name}`}
                      name={name}
                      value={profile[name] || ""}
                      onChange={updateProfileField}
                      placeholder={placeholder}
                      type={name === "email" ? "email" : "text"}
                      style={{
                        padding: "12px 14px",
                        border: "1px solid #dbe1ea",
                        borderRadius: "10px",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}

                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label htmlFor="profile-skills" style={{ fontWeight: 600, fontSize: "14px" }}>
                    Skills
                  </label>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <input
                      id="profile-skills"
                      value={newSkill}
                      onChange={(event) => setNewSkill(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add a skill (e.g. Python, AWS, SQL)"
                      style={{ flex: "1 1 240px", minWidth: 0, padding: "12px 14px", border: "1px solid #dbe1ea", borderRadius: "10px", boxSizing: "border-box" }}
                    />
                    <button type="button" className="secondary-button" onClick={addSkill}>
                      <Plus size={16} /> Add Skill
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(Array.isArray(profile.skills) ? profile.skills : []).map((skill) => (
                      <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 10px", borderRadius: "20px", background: "#eef2ff", color: "#4338ca", fontSize: "13px", fontWeight: 600 }}>
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0, display: "inline-flex" }}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <small style={{ color: "#64748b" }}>Press Enter or click Add Skill. Click × to remove a skill.</small>
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                    <label htmlFor="resume-upload" style={{ fontWeight: 600, fontSize: "14px" }}>
                      Upload Resume to ApplyTrack (PDF, DOC, DOCX)
                    </label>
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={uploadResume}
                      disabled={resumeUploading}
                      style={{ padding: "10px", border: "1px solid #dbe1ea", borderRadius: "10px", width: "100%", boxSizing: "border-box" }}
                    />
                    {resumeUploading && <p style={{ margin: 0 }}>Uploading resume securely...</p>}
                    {resumeError && <p style={{ margin: 0, color: "#dc2626" }}>{resumeError}</p>}
                    {resumeMessage && <p style={{ margin: 0, color: "#059669", fontWeight: 600 }}>{resumeMessage}</p>}
                    {profile.resume_key && (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <span style={{ color: "#64748b", fontSize: "13px" }}>
                          Uploaded: {profile.resume_file_name || "Resume file"}
                        </span>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={downloadResume}
                          disabled={resumeDownloading}
                          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                        >
                          <Download size={16} />
                          {resumeDownloading ? "Preparing..." : "Download Resume"}
                        </button>
                      </div>
                    )}
                    <small style={{ color: "#64748b" }}>
                      Files are stored privately in Amazon S3. Uploading replaces the resume saved in your profile.
                    </small>
                  </div>

                  <label htmlFor="profile-resume-url" style={{ fontWeight: 600, fontSize: "14px" }}>
                    Resume link (optional)
                  </label>
                  <input
                    id="profile-resume-url"
                    name="resume_url"
                    type="url"
                    value={profile.resume_url || ""}
                    onChange={updateProfileField}
                    placeholder="https://drive.google.com/... or https://..."
                    style={{ padding: "12px 14px", border: "1px solid #dbe1ea", borderRadius: "10px", width: "100%", boxSizing: "border-box" }}
                  />
                  <small style={{ color: "#64748b" }}>Optional: paste an external Google Drive, Dropbox, or portfolio resume link.</small>
                  {profile.resume_url && (
                    <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", textDecoration: "none" }}>
                      <ArrowUpRight size={16} /> Open Resume
                    </a>
                  )}
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "8px",
                  }}
                >
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={profileSaving}
                  >
                    <Save size={18} />
                    {profileSaving ? "Saving Profile..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <>
              <section className="welcome-section">
                <div>
                  <span className="eyebrow">YOUR JOB SEARCH WORKSPACE</span>
                  <h1>Welcome back, {profile.name || "Abhilash"} 👋</h1>
                  <p>
                    Track applications, monitor your progress, and stay ready
                    for your next opportunity.
                  </p>
                </div>

                <button className="primary-button" onClick={openAddForm}>
                  <Plus size={19} />
                  Add Application
                </button>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Total Applications</span>
                    <div className="stat-icon purple">
                      <BriefcaseBusiness size={21} />
                    </div>
                  </div>
                  <h2>{totalApplications}</h2>
                  <p className="stat-foot">Your tracked applications</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Interviews</span>
                    <div className="stat-icon blue">
                      <CalendarDays size={21} />
                    </div>
                  </div>
                  <h2>{interviewCount}</h2>
                  <p className="stat-foot">Interview-stage applications</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Offers Received</span>
                    <div className="stat-icon green">
                      <CheckCircle2 size={21} />
                    </div>
                  </div>
                  <h2>{offerCount}</h2>
                  <p className="stat-foot">Offers and selections</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Response Rate</span>
                    <div className="stat-icon orange">
                      <TrendingUp size={21} />
                    </div>
                  </div>
                  <h2>{responseRate}%</h2>
                  <p className="stat-foot">Interview and offer responses</p>
                </div>
              </section>

              {/* Application Pipeline */}
              <section
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid var(--border-color, #e5e7eb)",
                  borderRadius: "16px",
                  padding: "24px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Application Pipeline
                    </h3>
                    <p style={{ margin: 0, opacity: 0.65 }}>
                      Click any stage to filter your applications.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => setSelectedStatus("All")}
                  >
                    <Filter size={16} />
                    Show All
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {STATUSES.map((status) => {
                    const isSelected = selectedStatus === status;

                    return (
                      <button
                        key={status}
                        onClick={() => selectPipelineStatus(status)}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          padding: "16px",
                          borderRadius: "12px",
                          border: isSelected
                            ? `2px solid ${STATUS_COLORS[status]}`
                            : "1px solid var(--border-color, #e5e7eb)",
                          background: isSelected
                            ? `${STATUS_COLORS[status]}12`
                            : "transparent",
                          transition: "all 0.2s ease",
                          color: "inherit",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "12px",
                          }}
                        >
                          <span
                            style={{
                              width: "9px",
                              height: "9px",
                              borderRadius: "50%",
                              background: STATUS_COLORS[status],
                              display: "inline-block",
                            }}
                          />

                          <span style={{ fontSize: "13px", fontWeight: 600 }}>
                            {status}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          {statusCounts[status] || 0}
                        </div>

                        <div
                          style={{
                            fontSize: "12px",
                            opacity: 0.6,
                            marginTop: "8px",
                          }}
                        >
                          {statusCounts[status] === 1
                            ? "application"
                            : "applications"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Applications Table */}
              <section className="applications-card" id="applications">
                <div className="section-header">
                  <div>
                    <h3>
                      {selectedStatus === "All"
                        ? "Recent Applications"
                        : `${selectedStatus} Applications`}
                    </h3>

                    <p>
                      {filteredApplications.length} application
                      {filteredApplications.length !== 1 ? "s" : ""} displayed
                    </p>
                  </div>

                  <div className="table-actions">
                    <div className="search-box">
                      <Search size={18} />

                      <input
                        type="text"
                        placeholder="Search company or role..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>

                    <button
                      className="secondary-button"
                      onClick={fetchApplications}
                    >
                      <RefreshCw size={16} />
                      Refresh
                    </button>
                  </div>
                </div>

                {loading && (
                  <div className="table-message">
                    Loading applications...
                  </div>
                )}

                {error && <div className="error-message">{error}</div>}

                {!loading && !error && (
                  <div className="table-wrapper">
                    <table className="applications-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Position</th>
                          <th>Location</th>
                          <th>Applied Date</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredApplications.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="empty-state">
                              No applications found.
                            </td>
                          </tr>
                        ) : (
                          filteredApplications.map((application) => (
                            <tr key={application.id}>
                              <td>
                                <div className="company-cell">
                                  <div className="company-avatar">
                                    {application.company
                                      ?.charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <strong>{application.company}</strong>
                                </div>
                              </td>

                              <td>
                                {application.job_url ? (
                                  <a
                                    href={application.job_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open original job posting"
                                  >
                                    {application.role}{" "}
                                    <ArrowUpRight size={14} />
                                  </a>
                                ) : (
                                  application.role
                                )}
                              </td>

                              <td>{application.location || "—"}</td>
                              <td>{application.date || "—"}</td>

                              <td>
                                <select
                                  className={`status-badge ${getStatusClass(
                                    application.status
                                  )}`}
                                  value={application.status}
                                  title="Change application status"
                                  aria-label={`Change status for ${application.company}`}
                                  onChange={(event) =>
                                    handleQuickStatusChange(
                                      application,
                                      event.target.value
                                    )
                                  }
                                  style={{
                                    cursor: "pointer",
                                    border: "none",
                                    outline: "none",
                                    font: "inherit",
                                    fontWeight: 600,
                                    padding: "6px 10px",
                                  }}
                                >
                                  {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-action edit-action"
                                    title="Edit application"
                                    onClick={() =>
                                      openEditForm(application)
                                    }
                                  >
                                    <Pencil size={16} />
                                  </button>

                                  <button
                                    className="icon-action delete-action"
                                    title="Delete application"
                                    onClick={() =>
                                      handleDelete(application)
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Bottom Cards */}
              <section className="bottom-grid">
                <div className="bottom-card" id="interviews">
                  <h3>Upcoming Interviews</h3>
                  <p>Stay prepared for your next opportunity.</p>

                  {upcomingInterviews.length === 0 ? (
                    <div className="interview-empty">
                      <CalendarDays size={22} />
                      <Clock size={22} />
                      <strong>No interview dates scheduled</strong>
                      <span>
                        Edit an application, select Interview, and add its date and time.
                      </span>
                    </div>
                  ) : (
                    <div className="interview-list">
                      {upcomingInterviews.map((application) => (
                        <div className="interview-item" key={application.id}>
                          <div className="interview-date-time">
                            <CalendarDays size={17} />
                            <span>{formatInterviewDate(application.interview_date)}</span>
                            <Clock size={17} />
                            <span>{formatInterviewTime(application.interview_time)}</span>
                          </div>
                          <strong>{application.company}</strong>
                          <span>{application.role}</span>
                          <button
                            type="button"
                            className="icon-action edit-action"
                            title="Edit interview details"
                            onClick={() => openEditForm(application)}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bottom-card">
                  <h3>Application Progress</h3>
                  <p>Your job search overview.</p>

                  <div className="progress-summary">
                    <TrendingUp size={22} />

                    <div>
                      <span>Total applications</span>
                      <strong>{totalApplications}</strong>
                    </div>

                    <div>
                      <span>Interviews</span>
                      <strong>{interviewCount}</strong>
                    </div>

                    <div>
                      <span>Offers</span>
                      <strong>{offerCount}</strong>
                    </div>
                  </div>
                </div>
              </section>

              <footer className="footer">
                © 2026 ApplyTrack. Your job search, organized in one place.
              </footer>
            </>
          )}
        </div>
      </main>

      {/* Add/Edit Application Modal */}
      {showForm && (
        <div className="form-overlay" onClick={closeForm}>
          <div
            className="application-form"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="form-header">
              <h2>
                {editingId ? "Edit Application" : "Add New Application"}
              </h2>

              <button
                type="button"
                className="close-button"
                onClick={closeForm}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="company">Company Name</label>
              <input
                id="company"
                name="company"
                placeholder="e.g. Google"
                value={formData.company}
                onChange={handleInputChange}
                required
              />

              <label htmlFor="role">Job Role</label>
              <input
                id="role"
                name="role"
                placeholder="e.g. Software Engineer"
                value={formData.role}
                onChange={handleInputChange}
                required
              />

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                placeholder="e.g. Hyderabad / Remote"
                value={formData.location}
                onChange={handleInputChange}
              />

              <label htmlFor="job_url">Job URL</label>
              <input
                id="job_url"
                name="job_url"
                type="url"
                placeholder="https://..."
                value={formData.job_url}
                onChange={handleInputChange}
              />

              <label htmlFor="date">Applied Date</label>
              <input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
              />

              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {normalizeStatus(formData.status) === "Interview" && (
                <>
                  <label htmlFor="interview_date">Interview Date</label>
                  <input
                    id="interview_date"
                    name="interview_date"
                    type="date"
                    value={formData.interview_date || ""}
                    onChange={handleInputChange}
                    required
                  />

                  <label htmlFor="interview_time">Interview Time</label>
                  <input
                    id="interview_time"
                    name="interview_time"
                    type="time"
                    value={formData.interview_time || ""}
                    onChange={handleInputChange}
                    required
                  />
                </>
              )}

              <button
                type="submit"
                className="primary-button form-submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Application"
                  : "Save Application"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
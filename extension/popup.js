// ApplyTrack — AI-Powered Job Analyzer
// Uses the Cognito access token stored by the signed-in ApplyTrack dashboard.

const API_BASE =
  "https://a2ovi23axz7o7ebqjsfy5z2emu0ukeyy.lambda-url.ap-southeast-2.on.aws";

const DASHBOARD_URL = "http://localhost:5173";
const OIDC_CLIENT_ID = "3ih97oi4d9h56r2o89kn078fdc";
const OIDC_AUTHORITY =
  "https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_bGvPkc2wn";

let extractedJob = null;
let careerProfile = null;

const profileBtn = document.getElementById("profileBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const saveBtn = document.getElementById("saveBtn");
const loading = document.getElementById("loading");
const results = document.getElementById("results");
const message = document.getElementById("message");

profileBtn?.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.style.color = isError ? "#dc2626" : "#16a34a";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "";
}

function renderSkills(containerId, skills, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();

  if (!Array.isArray(skills) || skills.length === 0) {
    const tag = document.createElement("span");
    tag.className = "skill-tag";
    tag.textContent = "No skills detected";
    container.appendChild(tag);
    return;
  }

  skills.forEach(skill => {
    const tag = document.createElement("span");
    tag.className = `skill-tag ${type}`;
    tag.textContent = String(skill);
    container.appendChild(tag);
  });
}

// Find the signed-in ApplyTrack dashboard tab and read its OIDC user
// from that page's localStorage. The token is never sent to an external site.
async function getAccessToken() {
  const tabs = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });
  const dashboardTab = tabs.find(tab => tab.id && tab.url?.startsWith(DASHBOARD_URL));

  if (!dashboardTab?.id) {
    throw new Error("Please open ApplyTrack Dashboard and sign in first.");
  }

  const injected = await chrome.scripting.executeScript({
    target: { tabId: dashboardTab.id },
    func: (authority, clientId) => {
      const storageKey = `oidc.user:${authority}:${clientId}`;
      const raw = sessionStorage.getItem(storageKey);

      if (!raw) return { error: "No saved Cognito session found. Please sign in again." };

      try {
        const user = JSON.parse(raw);
        if (!user.access_token) return { error: "Cognito access token is missing." };

        if (user.expires_at && user.expires_at <= Math.floor(Date.now() / 1000)) {
          return { error: "Your session expired. Please sign in to ApplyTrack again." };
        }

        return { access_token: user.access_token };
      } catch {
        return { error: "Could not read the saved Cognito session." };
      }
    },
    args: [OIDC_AUTHORITY, OIDC_CLIENT_ID]
  });

  const result = injected?.[0]?.result;
  if (!result?.access_token) {
    throw new Error(result?.error || "Unable to get Cognito access token.");
  }
  return result.access_token;
}

async function authenticatedFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };
  return fetch(url, { ...options, headers });
}

async function getCareerProfile() {
  const response = await authenticatedFetch(`${API_BASE}/profile`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session unauthorized. Sign in to ApplyTrack Dashboard again.");
    }
    throw new Error("Unable to load Career Profile.");
  }

  const profile = await response.json();
  if (!profile || profile.message || profile.error) {
    throw new Error("Please create your Career Profile first.");
  }
  return profile;
}

function extractJobFromPage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: "extractJob" }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error("Could not read this page. Refresh the job page and try again."));
        return;
      }
      if (!response) {
        reject(new Error("No job details were extracted."));
        return;
      }
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

async function analyzeJobWithAI(job, profile) {
  const response = await authenticatedFetch(`${API_BASE}/analyze-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_title: job.title,
      company: job.company,
      job_description: job.description,
      profile
    })
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from AI backend.");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || `AI job analysis failed (HTTP ${response.status}).`);
  }
  if (!data.analysis) throw new Error("AI did not return analysis results.");
  return data.analysis;
}

function showMatch(score) {
  score = Math.max(0, Math.min(100, Number(score) || 0));
  setText("matchScore", score);

  const progress = document.getElementById("matchProgress");
  if (progress) progress.style.width = `${score}%`;

  let label = "Low Match";
  if (score >= 80) label = "Strong Match";
  else if (score >= 65) label = "Good Match";
  else if (score >= 45) label = "Partial Match";
  setText("matchLabel", label);
}

function showAIAnalysis(analysis) {
  let container = document.getElementById("aiAnalysis");
  if (!container) {
    container = document.createElement("div");
    container.id = "aiAnalysis";
    container.className = "field";
    const saveButton = document.getElementById("saveBtn");
    if (saveButton?.parentNode) saveButton.parentNode.insertBefore(container, saveButton);
    else results?.appendChild(container);
  }

  container.replaceChildren();

  function addHeading(text) {
    const heading = document.createElement("label");
    heading.textContent = text;
    container.appendChild(heading);
  }

  function addParagraph(text) {
    const paragraph = document.createElement("p");
    paragraph.style.whiteSpace = "pre-line";
    paragraph.textContent = text || "Not available";
    container.appendChild(paragraph);
  }

  addHeading("AI Recommendation"); addParagraph(analysis.recommendation);
  addHeading("AI Reason"); addParagraph(analysis.reason);
  addHeading("Job Summary"); addParagraph(analysis.job_summary);
  addHeading("Experience Level"); addParagraph(analysis.experience_level);
  addHeading("Work Mode"); addParagraph(analysis.work_mode);

  if (Array.isArray(analysis.responsibilities) && analysis.responsibilities.length) {
    addHeading("Key Responsibilities");
    addParagraph("• " + analysis.responsibilities.join("\n• "));
  }
  if (Array.isArray(analysis.improvement_tips) && analysis.improvement_tips.length) {
    addHeading("Improvement Tips");
    addParagraph("• " + analysis.improvement_tips.join("\n• "));
  }
  if (analysis.ai_provider) {
    addHeading("AI Provider"); addParagraph(analysis.ai_provider);
  }
}

analyzeBtn?.addEventListener("click", async () => {
  showMessage("");
  results?.classList.add("hidden");
  loading?.classList.remove("hidden");
  analyzeBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");

    const job = await extractJobFromPage(tab.id);
    if (!job.description || job.description.length < 100) {
      throw new Error("Job description is too short. Open the full job description and try again.");
    }

    extractedJob = job;
    careerProfile = await getCareerProfile();

    showMessage("Sending job description to Groq AI...");
    const analysis = await analyzeJobWithAI(job, careerProfile);

    setText("jobTitle", job.title || "Unknown title");
    setText("company", job.company || "Unknown company");
    showMatch(analysis.match_score);
    renderSkills("matchedSkills", analysis.matched_skills || [], "matched");
    renderSkills("missingSkills", analysis.missing_skills || [], "missing");
    showAIAnalysis(analysis);
    results?.classList.remove("hidden");
    showMessage("AI analysis completed successfully!");
  } catch (error) {
    console.error("ApplyTrack analysis error:", error);
    showMessage(error.message || "Something went wrong.", true);
  } finally {
    loading?.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
});

saveBtn?.addEventListener("click", async () => {
  if (!extractedJob) {
    showMessage("Please analyze a job before saving.", true);
    return;
  }

  saveBtn.disabled = true;
  try {
    const response = await authenticatedFetch(`${API_BASE}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: extractedJob.company,
        role: extractedJob.title,
        location: extractedJob.location || "Location not identified",
        job_url: extractedJob.url,
        status: "Saved"
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "Unable to save job.");
    showMessage("Job saved successfully!");
  } catch (error) {
    console.error("ApplyTrack save error:", error);
    showMessage(error.message || "Could not save job.", true);
  } finally {
    saveBtn.disabled = false;
  }
});

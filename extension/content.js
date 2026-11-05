/*

 * ApplyTrack — Job Extractor

 * Supports LinkedIn, Indeed, Naukri and other job websites.

 */

function cleanText(text) {

  return String(text || "")

    .replace(/\u00a0/g, " ")

    .replace(/[ \t\r]+/g, " ")

    .replace(/\n[ \t]+/g, "\n")

    .replace(/\n{3,}/g, "\n\n")

    .trim();

}

function getText(element) {

  if (!element) return "";

  return cleanText(element.innerText || element.textContent || "");

}

function getMetaContent(selectors) {

  for (const selector of selectors) {

    try {

      const element = document.querySelector(selector);

      const value = element?.content?.trim();

      if (value) return value;

    } catch (error) {

      console.warn("ApplyTrack meta selector error:", selector, error);

    }

  }

  return "";

}

function firstText(selectors, root = document) {

  for (const selector of selectors) {

    try {

      const elements = root.querySelectorAll(selector);

      for (const element of elements) {

        const text = getText(element);

        if (text && text.length < 250) {

          return text;

        }

      }

    } catch (error) {

      console.warn("ApplyTrack selector error:", selector, error);

    }

  }

  return "";

}

function cleanJobTitle(title) {

  return cleanText(title)

    .replace(/\s*[-|]\s*(LinkedIn|Indeed(?:\.com)?|Naukri(?:\.com)?)\s*$/i, "")

    .replace(/\s*[-|]\s*Job\s*$/i, "")

    .trim();

}

function isValidJobTitle(title) {

  if (!title) return false;

  const value = cleanJobTitle(title);

  return (

    value.length >= 2 &&

    value.length < 250 &&

    !/^(jobs|job search|job details|company|location|unknown)$/i.test(value)

  );

}

// =====================================================

// JOB TITLE

// =====================================================

function getJobTitle() {

  const host = location.hostname;

  let title = "";

  // LinkedIn

  if (host.includes("linkedin.com")) {

    title = firstText([

      ".job-details-jobs-unified-top-card__job-title",

      ".jobs-unified-top-card__job-title",

      ".top-card-layout__title",

      ".jobs-search__job-details--container h1",

      ".job-details h1",

      '[class*="job-details"] h1',

      '[data-job-title]'

    ]);

  }

  // Indeed

  else if (host.includes("indeed.com")) {

    title = firstText([

      '[data-testid="vj-job-title"]',

      '[data-testid="jobsearch-JobInfoHeader-title"]',

      '[data-testid="viewjob-title"]',

      ".jobsearch-JobInfoHeader-title",

      '[data-testid="viewjob-main-content"] h1',

      '[data-testid="viewjob-main-content"] h2'

    ]);

  }

  // Naukri

  else if (host.includes("naukri.com")) {

    title = firstText([

      'h1[class*="jd-header-title"]',

      '[class*="jd-header-title"] h1',

      '[class*="jd-header-title"]',

      '[data-testid="job-title"]'

    ]);

    const titleElement = document.querySelector(

      'h1[class*="jd-header-title"]'

    );

    if (titleElement?.getAttribute("title")) {

      title = titleElement.getAttribute("title");

    }

  }

  // Other job websites

  else {

    title = firstText([

      '[data-testid="job-title"]',

      '[class*="job-title"]',

      '[class*="jobTitle"]',

      '[itemprop="title"]',

      "h1"

    ]);

  }

  if (!isValidJobTitle(title)) {

    title = getMetaContent([

      'meta[property="og:title"]',

      'meta[name="twitter:title"]'

    ]);

  }

  if (!isValidJobTitle(title)) {

    title = document.title || "Job title not identified";

  }

  return cleanJobTitle(title);

}

// =====================================================

// COMPANY

// =====================================================

function normalizeCompanyName(company) {

  return cleanText(company)

    .replace(/\s*[-|]\s*(LinkedIn|Indeed|Naukri)(?:\.com)?\s*$/i, "")

    .replace(/\s*\(\s*reviews\s*\)\s*$/i, "")

    .trim();

}

function isValidCompanyName(company) {

  if (!company) return false;

  const value = normalizeCompanyName(company);

  const lower = value.toLowerCase();

  const invalid = [

    "company not identified",

    "company not found",

    "linkedin",

    "indeed",

    "naukri",

    "jobs",

    "job search",

    "employer",

    "unknown",

    "confidential"

  ];

  return (

    value.length >= 2 &&

    value.length < 150 &&

    !invalid.includes(lower)

  );

}

function normalizeCompanyName(company) {
  return cleanText(company)
    .replace(/\s*\(opens in a new tab\)\s*/ig, "")
    .replace(/\s*\(open in new tab\)\s*/ig, "")
    .replace(/^company\s*[,:\-]\s*/i, "")
    .replace(/\s*[-|]\s*(LinkedIn|Indeed(?:\.com)?|Naukri(?:\.com)?)\s*$/i, "")
    .replace(/\s*\(\s*reviews?\s*\)\s*$/i, "")
    .replace(/\s*\d+(?:\.\d+)?\s*(?:stars?|reviews?)\s*$/i, "")
    .replace(/[·•]\s*(opens in a new tab).*$/i, "")
    .trim();
}

function isValidCompanyName(company) {
  const value = normalizeCompanyName(company);
  if (!value || value.length < 2 || value.length > 140) return false;
  if (/^(company|company name|company not identified|company not found|employer|unknown|linkedin|indeed(?:\.com)?|naukri(?:\.com)?|jobs|job search|job details|about the company|view company)$/i.test(value)) return false;
  if (/^(remote|hybrid|on[- ]site|onsite|work from home)$/i.test(value)) return false;
  if (/\b(full[- ]time|part[- ]time|contract|internship|temporary|salary|₹|rs\.?|per annum|job type|applicants?|posted|reviews?)\b/i.test(value)) return false;
  if (/^[\d.,\s₹$+-]+$/.test(value)) return false;
  const title = typeof getJobTitle === "function" ? cleanJobTitle(getJobTitle()) : "";
  if (title && value.toLowerCase() === title.toLowerCase()) return false;
  return true;
}

function companyFromElement(el) {
  if (!el) return "";
  for (const raw of [el.getAttribute("data-company-name"), el.getAttribute("title"), el.getAttribute("aria-label"), getText(el)]) {
    const candidate = normalizeCompanyName(raw);
    if (isValidCompanyName(candidate)) return candidate;
  }
  return "";
}

function findCompany(selectors, root = document) {
  for (const selector of selectors) {
    try {
      for (const el of root.querySelectorAll(selector)) {
        const candidate = companyFromElement(el);
        if (candidate) return candidate;
      }
    } catch (_) {}
  }
  return "";
}

function companyFromJobPosting() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || "{}");
      const entries = Array.isArray(data) ? data : (data["@graph"] || [data]);
      for (const entry of entries) {
        const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
        if (!types.includes("JobPosting")) continue;
        const org = entry.hiringOrganization;
        const candidate = normalizeCompanyName(typeof org === "string" ? org : org?.name);
        if (isValidCompanyName(candidate)) return candidate;
      }
    } catch (_) {}
  }
  return "";
}

function getCompanyName() {
  const host = location.hostname.toLowerCase();

  if (host.includes("linkedin.com")) {
    const header =
      document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector(".jobs-unified-top-card") ||
      document.querySelector(".top-card-layout") || document;

    const selectors = [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".top-card-layout__card .topcard__org-name-link",
      "a[href*='/company/'][aria-label*='Company']",
      "a[href*='/company/']"
    ];

    for (const selector of selectors) {
      try {
        for (const el of header.querySelectorAll(selector)) {
          const raw = el.getAttribute("aria-label") || getText(el) || el.getAttribute("title");
          const candidate = normalizeCompanyName(raw).replace(/^company\s*[,:\-]\s*/i, "").replace(/[.!]$/, "");
          if (isValidCompanyName(candidate)) return candidate;
        }
      } catch (_) {}
    }
  }

  if (host.includes("indeed.com")) {
    const exactCompany = document.querySelector('[data-testid="vj-company-name"]');
    if (exactCompany) {
      const candidate = normalizeCompanyName(getText(exactCompany));
      if (isValidCompanyName(candidate)) return candidate;
    }

    const header =
      document.querySelector('[data-testid="desktop-job-header"]') ||
      document.querySelector('[data-testid="viewjob-header"]') ||
      document.querySelector('[data-testid="jobsearch-JobInfoHeader"]') ||
      document.querySelector('[data-testid="viewjob-main-content"]') ||
      document.querySelector("#jobsearch-ViewjobPaneWrapper") || document;

    const found = findCompany([
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="company-info-title-row"] a',
      '[data-testid="company-info-title-row"]',
      '[data-testid="company-info-metadata"] a[href*="/cmp/"]',
      '[data-testid="company-info-metadata"] a',
      '[data-testid="company-name"]',
      '[data-testid="companyName"]',
      ".jobsearch-InlineCompanyRating",
      ".jobsearch-CompanyInfoContainer a[href*='/cmp/']"
    ], header);
    if (found) return normalizeCompanyName(found);
  }

  if (host.includes("naukri.com")) {
    const header = document.querySelector("[class*='jd-header']") ||
      document.querySelector("[class*='jdHeader']") || document;
    const found = findCompany([
      "[class*='jd-header-comp-name'] a",
      "[class*='jd-header-comp-name']",
      "[class*='jdHeaderCompName'] a",
      "[class*='jdHeaderCompName']",
      "[class*='comp-name'] a",
      "[class*='comp-name']",
      "[class*='company-name'] a",
      "[class*='company-name']",
      "[class*='companyName']"
    ], header);
    if (found) return normalizeCompanyName(found);
  }

  return normalizeCompanyName(companyFromJobPosting()) || "Company not identified";
}

// =====================================================

// LOCATION HELPERS

// =====================================================

function looksLikeLocation(text) {

  if (!text) return false;

  const value = cleanText(text);

  if (value.length < 2 || value.length > 180) {

    return false;

  }

  if (

    /posted\s+\d+/i.test(value) ||

    /\d+\s+(day|hour|week|month)s?\s+ago/i.test(value) ||

    /applicants?/i.test(value) ||

    /people clicked apply/i.test(value) ||

    /full[- ]time|part[- ]time|contract|internship/i.test(value)

  ) {

    return false;

  }

  return (

    /,/.test(value) ||

    /\b(remote|hybrid|on[- ]site|onsite)\b/i.test(value) ||

    /\b(india|united states|united kingdom|canada|australia)\b/i.test(value) ||

    /\b(area|region)\b/i.test(value)

  );

}

function cleanLocation(locationText) {

  return cleanText(locationText)

    .replace(/^location\s*[:\-]\s*/i, "")

    .replace(/^based in\s*/i, "")

    .trim();

}

// =====================================================

// LINKEDIN LOCATION

// =====================================================

function getLinkedInLocation() {
  const clean = (value) =>
    String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isLocation = (value) => {
    const text = clean(value);

    if (!text || text.length > 120 || text.length < 2) return false;

    if (
      /reposted|ago|applicants?|clicked apply|promoted by|responses managed|full[- ]time|part[- ]time|internship/i.test(text)
    ) {
      return false;
    }

    return (
      /greater\s+.+\s+area/i.test(text) ||
      /,\s*[A-Za-z]/.test(text) ||
      /\b(remote|hybrid|on[- ]site|onsite)\b/i.test(text) ||
      /\b(india|united states|united kingdom|canada|australia)\b/i.test(text)
    );
  };

  // LinkedIn's current layout: location is an individual span
  // inside a paragraph followed by "Reposted..." and applicants.
  for (const paragraph of document.querySelectorAll("p")) {
    const paragraphText = clean(paragraph.innerText);

    if (
      !/reposted|people clicked apply|applicants/i.test(paragraphText)
    ) {
      continue;
    }

    for (const span of paragraph.querySelectorAll("span")) {
      const candidate = clean(span.innerText || span.textContent);

      if (isLocation(candidate)) {
        return candidate;
      }
    }

    // Fallback: split paragraph into metadata segments.
    const parts = paragraphText
      .split(/[·•]/)
      .map(clean)
      .filter(Boolean);

    for (const part of parts) {
      if (isLocation(part)) {
        return part;
      }
    }
  }

  // Legacy LinkedIn layout fallback.
  const selectors = [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description",
    ".jobs-unified-top-card__subtitle-primary-grouping",
    ".job-details-jobs-unified-top-card__primary-description",
    ".topcard__flavor"
  ];

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const parts = clean(element.innerText)
        .split(/[·•\n]/)
        .map(clean)
        .filter(Boolean);

      for (const part of parts) {
        if (isLocation(part)) {
          return part;
        }
      }
    }
  }

  // Last fallback: inspect individual spans across the page.
  for (const span of document.querySelectorAll("span")) {
    const candidate = clean(span.innerText || span.textContent);

    if (isLocation(candidate)) {
      return candidate;
    }
  }

  return "";
}

// =====================================================

// INDEED LOCATION

// =====================================================

function getIndeedLocation() {

  const metadata = document.querySelector(

    '[data-testid="company-info-metadata"]'

  );

  if (metadata) {

    const elements = metadata.querySelectorAll("div, span, li");

    const candidates = [];

    for (const element of elements) {

      const text = cleanLocation(getText(element));

      if (!text || text.length > 180) continue;

      if (

        text === getCompanyName() ||

        /full[- ]time|part[- ]time|contract|temporary|internship/i.test(text) ||

        /salary|pay information|posted/i.test(text)

      ) {

        continue;

      }

      if (looksLikeLocation(text)) {

        candidates.push({

          text,

          depth: element.querySelectorAll("*").length

        });

      }

    }

    candidates.sort((a, b) => a.depth - b.depth);

    if (candidates.length) {

      return candidates[0].text;

    }

  }

  const selectors = [

    '[data-testid="job-location"]',

    '[data-testid="jobsearch-JobInfoHeader-subtitle"]',

    '[data-testid="inlineHeader-companyLocation"]',

    ".jobsearch-JobInfoHeader-subtitle",

    ".jobsearch-JobInfoHeader-subtitle div",

    '[class*="jobLocation"]',

    '[class*="location"]'

  ];

  for (const selector of selectors) {

    try {

      const elements = document.querySelectorAll(selector);

      for (const element of elements) {

        const text = cleanLocation(getText(element));

        if (looksLikeLocation(text)) {

          return text;

        }

      }

    } catch (error) {

      console.warn("ApplyTrack Indeed location error:", error);

    }

  }

  return "";

}

// =====================================================

// NAUKRI LOCATION

// =====================================================

function getNaukriLocation() {

  // Current Naukri DOM selectors from your screenshot.

  const selectors = [

    '[class*="jhc__location"]',

    '[class*="jhc__loc"] [class*="location"]',

    '[class*="jd-header-loc"]',

    '[class*="jd-header-location"]',

    '[class*="loc-container"]',

    '[class*="job-location"]',

    '[class*="jd-location"]'

  ];

  for (const selector of selectors) {

    const elements = document.querySelectorAll(selector);

    for (const element of elements) {

      // Prefer the location link itself.

      const link = element.querySelector("a[title]");

      if (link) {

        const locationText = cleanLocation(

          link.innerText || link.getAttribute("title")

        );

        if (locationText && looksLikeLocation(locationText)) {

          return locationText;

        }

      }

      const text = cleanLocation(getText(element));

      if (

        text &&

        text.length < 150 &&

        looksLikeLocation(text) &&

        !/experience|salary|lac|lpa|month|year/i.test(text)

      ) {

        return text;

      }

    }

  }

  // Specific fallback for "Hiring office located in Chennai".

  const locationLink = document.querySelector(

    '[class*="jhc__location"] a[title]'

  );

  if (locationLink) {

    const text = cleanLocation(

      locationLink.innerText || locationLink.getAttribute("title")

    );

    if (text) return text;

  }

  return "";

}

// =====================================================

// GENERIC LOCATION

// =====================================================

function getGenericLocation() {

  const selectors = [

    '[data-testid="job-location"]',

    '[data-testid="location"]',

    '[class*="job-location"]',

    '[class*="jobLocation"]',

    ".job-location",

    ".location",

    '[itemprop="jobLocation"]',

    '[class*="location"]'

  ];

  for (const selector of selectors) {

    try {

      const elements = document.querySelectorAll(selector);

      for (const element of elements) {

        const text = cleanLocation(getText(element));

        if (looksLikeLocation(text)) {

          return text;

        }

      }

    } catch (error) {

      console.warn("ApplyTrack generic location error:", error);

    }

  }

  return "";

}

function normalizeJobLocation(value) {
  let v = cleanText(value)
    .replace(/^location\s*[:\-]\s*/i, "")
    .replace(/^based in\s*/i, "")
    .replace(/\s*[-–—]\s*$/g, "")
    .trim();

  const separatorParts = v.split(/\s*[·•]\s*/).map(x => x.trim()).filter(Boolean);
  if (separatorParts.length > 1) v = separatorParts[0];

  const parts = v.split(",").map(x => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const unique = [];
    const seen = new Set();
    for (const part of parts) {
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(part);
      }
    }
    v = unique.join(", ");
  }

  const tokens = v.split(",").map(x => x.trim()).filter(Boolean);
  if (tokens.length >= 4 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    if (tokens.slice(0, half).join("|").toLowerCase() === tokens.slice(half).join("|").toLowerCase()) {
      v = tokens.slice(0, half).join(", ");
    }
  }
  return v;
}

function isValidJobLocation(value) {
  const v = normalizeJobLocation(value);
  if (!v || v.length < 2 || v.length > 180) return false;
  if (/^(location|job location|unknown|not specified|location not identified)$/i.test(v)) return false;
  if (/\b(applicants?|posted|ago|promoted|salary|₹|lpa|full[- ]time|part[- ]time|contract|internship|experience)\b/i.test(v)) return false;
  return /,|remote|hybrid|on[- ]site|onsite|work from home|india|united states|united kingdom|canada|australia|singapore|uae/i.test(v);
}

function locationFromSelectors(selectors, root = document) {
  for (const selector of selectors) {
    try {
      for (const el of root.querySelectorAll(selector)) {
        const raw = el.getAttribute("title") || el.getAttribute("aria-label") || getText(el);
        const parts = normalizeJobLocation(raw).split(/[·•]/).map(normalizeJobLocation).filter(Boolean);
        for (const part of parts) if (isValidJobLocation(part)) return part;
      }
    } catch (_) {}
  }
  return "";
}

function locationFromJobPosting() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || "{}");
      const entries = Array.isArray(data) ? data : (data["@graph"] || [data]);
      for (const entry of entries) {
        const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
        if (!types.includes("JobPosting")) continue;
        if (entry.jobLocationType === "TELECOMMUTE") return "Remote";
        const jobLoc = Array.isArray(entry.jobLocation) ? entry.jobLocation : [entry.jobLocation];
        for (const loc of jobLoc) {
          const addr = loc?.address;
          const candidate = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry].filter(Boolean).join(", ");
          if (isValidJobLocation(candidate)) return normalizeJobLocation(candidate);
        }
      }
    } catch (_) {}
  }
  return "";
}

function getJobLocation() {
  const host = location.hostname.toLowerCase();

  if (host.includes("linkedin.com")) {
    // Prefer dedicated parser for LinkedIn top-card metadata: location appears
    // before posted-date/applicant count separated by middle dots.
    const linkedinLocation = getLinkedInLocation();
    if (linkedinLocation) return normalizeJobLocation(linkedinLocation);

    const header = document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector(".jobs-unified-top-card") || document.querySelector(".top-card-layout") || document;
    const found = locationFromSelectors([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description",
      ".jobs-unified-top-card__subtitle-primary-grouping",
      ".job-details-jobs-unified-top-card__primary-description",
      "[class*='job-location']", "[class*='jobLocation']"
    ], header);
    if (found) return found;
  }

  if (host.includes("indeed.com")) {
    const header = document.querySelector('[data-testid="desktop-job-header"]') ||
      document.querySelector('[data-testid="viewjob-header"]') ||
      document.querySelector('[data-testid="jobsearch-JobInfoHeader"]') ||
      document.querySelector('[data-testid="viewjob-main-content"]') ||
      document.querySelector("#jobsearch-ViewjobPaneWrapper") || document;

    // Indeed's current desktop viewjob DOM uses company-info-metadata
    // with leaf divs for location/work arrangement/pay/work type.
    const directLocationSelectors = [
      '[data-testid="vj-job-location"]',
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="job-location"]',
      '[data-testid="jobsearch-JobInfoHeader-location"]',
      '[itemprop="jobLocation"]'
    ];

    for (const selector of directLocationSelectors) {
      try {
        const nodes = header.querySelectorAll(selector);
        for (const node of nodes) {
          const candidate = normalizeJobLocation(
            node.getAttribute("title") || node.getAttribute("aria-label") || getText(node)
          );
          if (isValidJobLocation(candidate)) return candidate;
        }
      } catch (_) {}
    }

    // Read metadata leaf nodes (e.g. "Remote", "Hyderabad, Telangana").
    const metadata = header.querySelector('[data-testid="company-info-metadata"]') ||
      document.querySelector('[data-testid="company-info-metadata"]');

    if (metadata) {
      const leaves = [...metadata.querySelectorAll("div, span")]
        .filter(node => !node.querySelector("div, span"))
        .map(node => normalizeJobLocation(getText(node)))
        .filter(Boolean);

      for (const candidate of leaves) {
        if (isValidJobLocation(candidate) &&
            !/salary|pay|month|year|full[- ]time|part[- ]time|contract|temporary|internship|fresher|day shift/i.test(candidate)) {
          return candidate;
        }
      }

      // If a nested element contains multiple metadata labels, split them.
      const metadataText = getText(metadata);
      const parts = metadataText.split(/[·•\n]/).map(normalizeJobLocation).filter(Boolean);
      for (const candidate of parts) {
        if (isValidJobLocation(candidate) &&
            !/salary|pay|month|year|full[- ]time|part[- ]time|contract|temporary|internship|fresher|day shift/i.test(candidate)) {
          return candidate;
        }
      }
    }

    const found = locationFromSelectors([
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="job-location"]',
      '[data-testid="jobsearch-JobInfoHeader-subtitle"]',
      '[data-testid="jobsearch-JobInfoHeader-location"]',
      ".jobsearch-JobInfoHeader-subtitle",
      "[class*='jobLocation']", "[class*='job-location']"
    ], header);
    if (found) return found;
  }

  if (host.includes("naukri.com")) {
    const header = document.querySelector("[class*='jd-header']") ||
      document.querySelector("[class*='jdHeader']") || document;
    const found = locationFromSelectors([
      "[class*='jhc__location']", "[class*='jhc__loc']",
      "[class*='jd-header-loc']", "[class*='jd-header-location']",
      "[class*='loc-container']", "[class*='job-location']",
      "[class*='jd-location']", "[itemprop='jobLocation']"
    ], header);
    if (found) return normalizeJobLocation(found);
  }

  return locationFromJobPosting() || "Location not identified";
}

// =====================================================

// JOB DESCRIPTION

// =====================================================

function removeUnwantedElements(clone) {

  const selectors = [

    "nav",

    "header",

    "footer",

    "form",

    "button",

    "input",

    "select",

    "textarea",

    "script",

    "style",

    "iframe",

    "svg",

    "noscript",

    '[role="navigation"]',

    '[role="banner"]',

    '[role="contentinfo"]',

    '[class*="cookie"]',

    '[class*="sidebar"]',

    '[class*="navigation"]',

    '[class*="breadcrumb"]',

    '[class*="apply-form"]',

    '[class*="application-form"]',

    '[class*="related-jobs"]',

    '[class*="recommended-jobs"]'

  ];

  try {

    clone.querySelectorAll(selectors.join(",")).forEach(element => {

      element.remove();

    });

  } catch (error) {

    console.warn("ApplyTrack cleanup error:", error);

  }

}

function formatDescription(clone) {

  clone.querySelectorAll("h1, h2, h3, h4, p, li").forEach(element => {

    element.insertAdjacentText("beforebegin", "\n");

    element.insertAdjacentText("afterend", "\n");

  });

  return cleanText(clone.innerText || clone.textContent);

}

function scoreCandidate(element) {

  const text = getText(element);

  if (!text || text.length < 300) {

    return 0;

  }

  let score = Math.min(text.length / 100, 100);

  const keywords = [

    "responsibilities",

    "requirements",

    "qualifications",

    "experience",

    "skills",

    "job description",

    "what you'll do",

    "what you will do",

    "about the role",

    "preferred qualifications",

    "salary",

    "benefits",

    "education"

  ];

  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {

    if (lowerText.includes(keyword)) {

      score += 15;

    }

  }

  if (text.length > 800) score += 30;

  if (text.length > 2000) score += 50;

  return score;

}

function findBestJobDescription() {

  const selectors = [

    "#jobDescriptionText",

    "#job-description",

    "#jobDescription",

    ".job-description",

    ".job-description-content",

    ".jobsearch-jobDescriptionText",

    ".jobs-description__content",

    ".jobs-box__html-content",

    ".description__text",

    ".job-details",

    '[data-testid="job-description"]',

    '[data-automation="job-details"]',

    "article",

    "main",

    '[role="main"]'

  ];

  const candidates = [];

  for (const selector of selectors) {

    try {

      document.querySelectorAll(selector).forEach(element => {

        candidates.push(element);

      });

    } catch (error) {

      console.warn("ApplyTrack description selector error:", error);

    }

  }

  if (document.body) {

    candidates.push(document.body);

  }

  const uniqueCandidates = [...new Set(candidates)];

  let bestElement = null;

  let bestScore = 0;

  for (const element of uniqueCandidates) {

    const score = scoreCandidate(element);

    if (score > bestScore) {

      bestScore = score;

      bestElement = element;

    }

  }

  return bestElement || document.body;

}

// =====================================================

// MAIN EXTRACTION

// =====================================================

function extractJobDetails() {

  const title = getJobTitle();

  const company = getCompanyName();

  const location = getJobLocation();

  const source = findBestJobDescription();

  const clone = source.cloneNode(true);

  removeUnwantedElements(clone);

  let description = formatDescription(clone);

  const unwantedLines = [

    /^apply now$/i,

    /^apply for this job$/i,

    /^back to jobs$/i,

    /^share this job$/i,

    /^save job$/i,

    /^submit application$/i,

    /^sign in$/i,

    /^sign up$/i,

    /^login$/i,

    /^register$/i

  ];

  description = description

    .split("\n")

    .map(line => line.trim())

    .filter(line =>

      line &&

      !unwantedLines.some(pattern => pattern.test(line))

    )

    .join("\n");

  description = cleanText(description);

  const extractionQuality =

    description.length > 1500 ? "good" :

    description.length > 500 ? "partial" :

    "low";

  return {

    title,

    company,

    location,

    description: description.slice(0, 20000),

    url: window.location.href,

    page_title: document.title,

    extracted_at: new Date().toISOString(),

    extraction_quality: extractionQuality

  };

}

// =====================================================

// CHROME MESSAGE LISTENER

// =====================================================

chrome.runtime.onMessage.addListener(

  (message, sender, sendResponse) => {

    if (message.action === "extractJob") {

      try {

        const jobDetails = extractJobDetails();

        sendResponse(jobDetails);

      } catch (error) {

        console.error("ApplyTrack extraction error:", error);

        sendResponse({

          title: document.title || "Job title not identified",

          company: "Company not identified",

          location: "Location not identified",

          description: "",

          url: window.location.href,

          extraction_quality: "low",

          error: error.message

        });

      }

    }

    return true;

  }

);

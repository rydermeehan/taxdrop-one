# TaxDrop Content Studio — User Guide

**URL:** studio.taxdrop.com
**Password:** `sup`

---

## What Is This Tool?

Content Studio is TaxDrop's internal content production platform. It generates, reviews, and publishes CMS content directly to TaxDrop.com (Webflow), creates social media posts with images, manages SEO analysis, and handles email promotion — all from one dashboard.

---

## Getting Started

### First-Time Setup

Go to **Settings** (bottom of the left sidebar) and configure these integrations:

| Integration | Required For | Where to Get the Key |
|---|---|---|
| **OpenRouter** | All AI generation | openrouter.ai/keys |
| **Webflow** | Publishing to CMS | Webflow Project Settings > Integrations > API Access |
| **Google Search Console** | SEO keyword data | Google Cloud Console (OAuth credentials) |
| **NeuronWriter** | SEO content scoring | NeuronWriter Profile > Neuron API Access |
| **OnlySocial** | Scheduling social posts | OnlySocial account settings |
| **SendFox** | Email marketing | sendfox.com/account/oauth |
| **Meta** | Social inbox (FB/IG) | Meta Graph API Explorer |

Only **OpenRouter** is required. Everything else adds features but degrades gracefully if not configured.

---

## Content Types

The left sidebar lists six content types. Each follows the same **Setup > Refine > Review > Publish** workflow.

### Blog Posts
Full SEO blog articles (1,200-2,000 words). Generates 15 fields including post content, SEO title, meta description, FAQs, key fact bullets, and a photo prompt for hero image generation.

**Blog-specific features:**
- GSC keyword suggestions on the Setup tab
- 3 title options to choose from before generation
- NeuronWriter SEO score in the Review tab
- Post-publish promotion pipeline (social + email)

### Glossary Terms
Property tax terminology definitions. Generates 17 fields including short definition, full definition, example, why-it-matters section, and 3 FAQ pairs.

### Partner Pages
Landing pages for referral partners (real estate agents, mortgage brokers, etc.). Generates 44 fields across 3 AI calls — hero section, 6 benefits, 3 use cases, testimonial, FAQs, and CTA.

### Property Type Pages
Pages for specific property types (single family homes, office buildings, ranch land). Generates 25 fields covering assessment issues, appeal strategies, valuation methods, and success metrics.

### Help Center Articles
Support/FAQ articles for the TaxDrop help center. Generates 7 fields with a focused, practical tone.

### County Pages
County-specific landing pages with local property tax details. Generates 20 fields. Automatically uses the correct terminology — "protest" for Texas counties, "appeal" for California counties.

---

## The 4-Tab Workflow

### Tab 1: Setup

1. **Enter your concept** — Describe what you want to create. More detail = better output. If your concept is over 200 characters, clarification questions can be skipped.

2. **Answer setup questions** — Each content type has required questions (state, category, keywords, etc.).

3. **GSC Keywords (Blog posts only)** — If Google Search Console is connected, a collapsible panel shows keyword opportunities from your actual search data. Click keywords to add them to the generation prompt. Each chip shows impressions and opportunity level.

4. **Choose your AI model** — Default is Claude Sonnet 4.5. Use Opus for higher quality on important pieces, Haiku for quick drafts.

5. **Click Generate** — This opens the clarification chat.

### Tab 2: Refine

The AI generates 3-5 clarifying questions about your concept. Answer them to improve output quality, or click **Skip** to generate immediately.

**Blog posts get an extra step:** After clarification, you'll see **3 title options** with different angles:
- One leads with data/numbers
- One leads with a benefit/outcome
- One leads with a hook/curiosity

Pick the title that fits your strategy, click **Use This Title**, and generation begins. You can also regenerate titles or skip to let the AI decide.

### Tab 3: Review

This is where you review and edit every AI-generated field before publishing.

**Review progress bar** — Shows how many fields you've marked as reviewed. All fields must be reviewed before publishing is unlocked.

**For each field:**
- Read the generated content
- Edit if needed (text fields are editable inline)
- Click **Mark Reviewed** when you're satisfied
- If you edit a field after marking it reviewed, it resets to unreviewed

**Hero image** — Generates automatically from the `photo-prompt` field. Shows a preview with the uploaded image. Click **Regenerate Image** if you want a different one.

**SEO Score (Blog posts only)** — If NeuronWriter is configured and a query ID exists, click **Check SEO Score** to evaluate your content. Shows a 0-100 score, terms used vs. total recommended, and optimization advice. Edit content and recheck as needed.

**Validation** — Red badges flag issues (missing required fields, character count violations). Fix them before publishing.

### Tab 4: Publish

**Pre-publish checklist:**
- Content generated
- All required fields valid
- All fields reviewed by human
- Webflow API connected
- Hero image uploaded (soft requirement — doesn't block publishing)

**Publishing options:**
- **Save as Draft** — Creates the item in Webflow CMS but doesn't make it live
- **Publish Live** — Creates and publishes immediately to TaxDrop.com
- **Copy JSON** — Copies all field data to clipboard for manual use

Both draft and live options require confirmation before executing.

**Post-publish checklist** — After publishing, verify in Webflow:
- All fields look correct
- Page formatting and images render properly
- State terminology is correct
- SEO title/description appear in page settings
- URL slug is correct

**Promotion Pipeline (Blog posts only)** — After a successful publish, two sections appear:

**Social Media Promotion:**
- Auto-generates posts for LinkedIn, Instagram, Facebook, and Twitter/X
- Each post is editable and has a Copy button
- Click **Generate Platform Images** for optimized images (1:1 for Instagram, 16:9 for others)
- If OnlySocial is connected, you can schedule directly from the tool

**Email Newsletter:**
- Auto-generates a subject line, preheader, and HTML email body
- Shows a rendered preview of the email
- Copy buttons for subject, preheader, and full HTML body
- Paste into SendFox or your email tool

---

## Other Tools

### Image Studio
Generate AI images for blog posts, social media, and other uses.

- **Image types:** Hero (16:9), Thumbnail (16:9), Square (1:1), Story (9:16), OG Image (1.91:1)
- **Logo overlays:** Add TaxDrop logos in different formats
- Enter a custom prompt or use the suggested prompts
- Previously generated images are saved in a gallery

### Social Media Generator
Standalone tool for creating social media content separate from blog posts.

- **Platforms:** Instagram Post, Instagram Story, Facebook, LinkedIn, Twitter/X
- **Style presets:** TaxDrop Brand, Photorealistic, Lifestyle, Bright & Airy
- **17+ scene templates:** Front Porch, Kitchen Table, Good News at Mailbox, etc.
- **Promote a Link mode:** Paste a blog URL, auto-fetches the page content, generates platform-specific promotional posts
- Direct scheduling via OnlySocial if configured

### Character Generator
Create consistent AI-generated characters for use across multiple images.

1. Upload a reference photo and describe the character
2. Generate new images of that character in different scenes, outfits, and poses
3. **13 scene presets** (Front Porch, Living Room, Kitchen, etc.)
4. **10 outfit presets** (Casual, Business Casual, TaxDrop Branded, etc.)
5. **12 pose presets** (Reading a Letter, Smiling, Thumbs Up, etc.)

### Prompt Library
Reusable prompt templates with variable substitution.

- **SEO Blog Post Generator** — Structured blog prompt with state context and keyword targets
- **Social Media Post Batch** — Generate multiple posts for a platform
- **Email Sequence Builder** — Multi-email nurture sequences

Fill in the variables, select your AI model, and generate. Social prompts can publish directly to OnlySocial.

### Search Console Dashboard
View Google Search Console data directly in the tool.

- **Overview:** Total clicks, impressions, CTR, average position
- **Top Queries:** Full query performance table (sortable, up to 100 rows)
- **Content Ideas:** AI-analyzed keyword opportunities — queries with high impressions but low CTR
- **Inspect URL:** Check any URL's indexing status

### NeuronWriter Dashboard
SEO content analysis and optimization.

- **Projects:** Browse NeuronWriter projects and queries. View recommended terms, related questions, and competitor data
- **Analyze:** Paste content to evaluate against a keyword query
- **New Query:** Create a new keyword analysis

### Engagement / Social Inbox
Triage social media comments and DMs.

- View and categorize incoming comments/messages from Facebook, Instagram, Twitter, LinkedIn
- **Categories:** Lead, Question, Positive, Negative, Spam, Conversational
- **Status workflow:** Pending Review > Replied / Ignored / Escalated
- Filter by platform, category, status, urgency
- Import data from N8N webhook via JSON paste

---

## Tips for Best Results

### Writing Better Concepts
- Be specific: "Property tax protest tips for Harris County, Texas homeowners in 2026" beats "property tax tips"
- Include the target audience: homeowners vs. landlords, new buyers vs. long-time owners
- Mention any specific stats, data points, or angles you want included
- For blog posts, specify whether it's a how-to guide, news article, or opinion piece

### State Terminology
Always set the correct state. The AI uses different terminology:
- **Texas:** protest, Appraisal District, Notice of Appraised Value, May 15 deadline
- **California:** appeal, Assessor's Office, Assessment Notice, varies by county
- **General:** uses neutral terms or mentions both

### SEO Workflow (Blog Posts)
For the best SEO results:
1. Check GSC keyword suggestions on the Setup tab — select relevant keywords
2. Choose a title from the 3 options that best targets your primary keyword
3. After generation, check the NeuronWriter SEO score in the Review tab
4. Edit content to include missing recommended terms
5. Recheck the score until you're satisfied

### Reviewing Content
- Read every field — AI-generated content can have factual errors
- Check all statistics and numbers for plausibility
- Verify links and URLs are real
- Ensure CTAs match the current TaxDrop offering
- Check that state terminology is consistent throughout

### Publishing Workflow
1. Always **Save as Draft** first for important content
2. Preview in Webflow before publishing live
3. Use the post-publish checklist to verify everything
4. For blog posts, use the promotion pipeline to create social and email content immediately while the context is fresh

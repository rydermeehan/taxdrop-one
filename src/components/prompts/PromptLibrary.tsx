import { useState, useEffect } from 'react';
import { generateText, TEXT_MODELS, type TextModel, hasApiKey } from '../../services/openrouterService';
import {
  hasOnlySocialConfig,
  listAccounts as listOnlySocialAccounts,
  createPost as createOnlySocialPost,
  type OnlySocialAccount,
} from '../../services/onlySocialService';
import { hasSendFoxApiKey, getLists as getSendFoxLists, type SendFoxList } from '../../services/sendfoxService';

interface PromptVariable {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

interface Prompt {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  template: string;
  variables: PromptVariable[];
  outputType?: 'blog' | 'social' | 'email' | 'general';
}

const PROMPTS: Prompt[] = [
  // Content Creation
  {
    id: 'blog-post-generator',
    title: 'SEO Blog Post Generator',
    description: 'Generate a comprehensive, SEO-optimized blog post with proper structure and internal linking.',
    category: 'Content Creation',
    icon: '📝',
    outputType: 'blog',
    template: `Write a comprehensive blog post for TaxDrop about {{TOPIC}}.

**Target Audience:** {{AUDIENCE}}
**Primary Keyword:** {{PRIMARY_KEYWORD}}
**Secondary Keywords:** {{SECONDARY_KEYWORDS}}
**Word Count Target:** {{WORD_COUNT}}

**Requirements:**
- Use conversational, friendly tone (not corporate or salesy)
- Short sentences and 2-4 line paragraphs
- Include practical, actionable advice
- Use proper heading hierarchy (H2, H3)
- Include a compelling introduction that hooks the reader
- Add a clear call-to-action at the end

**State Context:** {{STATE}}
- Use "protest" terminology for Texas
- Use "appeal" terminology for California

**Structure:**
1. Hook + problem statement
2. Why this matters (stats if available)
3. Step-by-step solution/guide
4. Common mistakes to avoid
5. Key takeaways
6. CTA to TaxDrop

**Internal Links to Include:**
{{INTERNAL_LINKS}}

**Tone Examples:**
- Good: "Here's the truth about property tax appeals..."
- Bad: "Our comprehensive solutions enable homeowners to..."`,
    variables: [
      { key: 'TOPIC', label: 'Blog Topic', placeholder: 'How to protest your property taxes in Texas', type: 'text' },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Texas homeowners who just received their assessment notice', type: 'text' },
      { key: 'PRIMARY_KEYWORD', label: 'Primary Keyword', placeholder: 'property tax protest Texas', type: 'text' },
      { key: 'SECONDARY_KEYWORDS', label: 'Secondary Keywords', placeholder: 'appraisal district, notice of appraised value, informal hearing', type: 'text' },
      { key: 'WORD_COUNT', label: 'Word Count', placeholder: '1500-2000', type: 'text' },
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'INTERNAL_LINKS', label: 'Internal Links', placeholder: '/glossary/appraisal-district\n/texas/harris-county', type: 'textarea' },
    ],
  },
  {
    id: 'social-post-batch',
    title: 'Social Media Post Batch',
    description: 'Generate multiple social media posts from a single topic or blog post.',
    category: 'Content Creation',
    icon: '📱',
    outputType: 'social',
    template: `Create {{POST_COUNT}} social media posts about {{TOPIC}} for TaxDrop.

**Platform:** {{PLATFORM}}
**Content Source:** {{SOURCE}}
**Campaign Goal:** {{GOAL}}

**Voice Guidelines:**
- Conversational and helpful
- Confident but not salesy
- Use "you" and "your" language
- No jargon without explanation
- Emojis: {{EMOJI_STYLE}}

**Post Requirements:**
{{REQUIREMENTS}}

**CTA Options to Rotate:**
- "Start your free savings estimate"
- "See what you could save"
- "Get your property tax analysis"

**Hashtags to Consider:**
{{HASHTAGS}}

**Create posts that:**
1. Stop the scroll with a hook
2. Deliver quick value
3. Drive action

Format each post with:
- POST #1
- [Hook line]
- [Body]
- [CTA]
- [Hashtags]`,
    variables: [
      { key: 'POST_COUNT', label: 'Number of Posts', placeholder: '5', type: 'text' },
      { key: 'TOPIC', label: 'Topic', placeholder: 'Property tax deadline approaching in Texas', type: 'text' },
      { key: 'PLATFORM', label: 'Platform', placeholder: 'LinkedIn', type: 'select', options: ['LinkedIn', 'Facebook', 'Instagram', 'Twitter/X', 'TikTok'] },
      { key: 'SOURCE', label: 'Content Source (optional)', placeholder: 'Link to blog post or paste key points', type: 'textarea' },
      { key: 'GOAL', label: 'Campaign Goal', placeholder: 'Drive signups before May 15 deadline', type: 'text' },
      { key: 'EMOJI_STYLE', label: 'Emoji Style', placeholder: 'Minimal (1-2 per post)', type: 'select', options: ['None', 'Minimal (1-2 per post)', 'Moderate', 'Heavy'] },
      { key: 'REQUIREMENTS', label: 'Specific Requirements', placeholder: '- Include stat about 30-60% overassessment\n- Mention May 15 deadline\n- Keep under 150 words', type: 'textarea' },
      { key: 'HASHTAGS', label: 'Hashtags', placeholder: '#PropertyTax #TexasHomeowners #TaxSavings', type: 'text' },
    ],
  },
  {
    id: 'email-sequence',
    title: 'Email Sequence Builder',
    description: 'Create a multi-email nurture sequence for leads.',
    category: 'Content Creation',
    icon: '✉️',
    outputType: 'email',
    template: `Create a {{EMAIL_COUNT}}-email nurture sequence for TaxDrop.

**Sequence Trigger:** {{TRIGGER}}
**Target Segment:** {{SEGMENT}}
**Primary Goal:** {{GOAL}}
**Sending Cadence:** {{CADENCE}}

**Sequence Theme:** {{THEME}}

**Brand Voice:**
- Friendly and helpful, like a knowledgeable neighbor
- Confident but not pushy
- Educational first, promotional second
- Short paragraphs, scannable format

**Email Structure (each email):**
1. Subject line (under 50 chars, create urgency or curiosity)
2. Preview text
3. Opening hook (1-2 sentences)
4. Value content (2-3 short paragraphs)
5. Single clear CTA
6. P.S. line (optional but effective)

**Key Messages to Cover Across Sequence:**
{{KEY_MESSAGES}}

**CTAs to Rotate:**
- Start your free estimate
- See your potential savings
- Book a call with our team
- Download our guide

**Success Metrics:**
- Open rate target: 35%+
- Click rate target: 5%+`,
    variables: [
      { key: 'EMAIL_COUNT', label: 'Number of Emails', placeholder: '5', type: 'text' },
      { key: 'TRIGGER', label: 'Sequence Trigger', placeholder: 'User started but didn\'t complete signup', type: 'text' },
      { key: 'SEGMENT', label: 'Target Segment', placeholder: 'Texas homeowners who received their assessment notice', type: 'text' },
      { key: 'GOAL', label: 'Primary Goal', placeholder: 'Get them to complete their property tax protest signup', type: 'text' },
      { key: 'CADENCE', label: 'Sending Cadence', placeholder: 'Day 1, Day 3, Day 5, Day 7, Day 10', type: 'text' },
      { key: 'THEME', label: 'Sequence Theme', placeholder: 'Deadline urgency - May 15 approaching', type: 'text' },
      { key: 'KEY_MESSAGES', label: 'Key Messages', placeholder: '- 30-60% of properties are overassessed\n- Only 5% of owners appeal\n- No fee if savings under $500\n- Takes less than 2 minutes to start', type: 'textarea' },
    ],
  },
  // Analysis & Strategy
  {
    id: 'content-performance-analyzer',
    title: 'Content Performance Analyzer',
    description: 'Analyze content performance data to identify what\'s working and strategic gaps.',
    category: 'Analysis & Strategy',
    icon: '📊',
    outputType: 'general',
    template: `Analyze the following content performance data for TaxDrop.

**Performance Data:**
{{PERFORMANCE_DATA}}

**Content Details:**
{{CONTENT_DETAILS}}

**Primary Goal:** {{GOAL}}
**Time Period:** {{TIME_PERIOD}}

**Analysis Required:**

1. **Top Performers**
   - Which content pieces performed best?
   - What do they have in common (topic, format, timing)?
   - Why do you think they worked?

2. **Underperformers**
   - Which content underperformed expectations?
   - Should it be refreshed, repurposed, or retired?
   - What can we learn from the failures?

3. **Patterns & Insights**
   - Topic trends that resonate with our audience
   - Best publishing times/days
   - Format preferences (long-form vs short, etc.)
   - Seasonal patterns related to tax deadlines

4. **Content Gaps**
   - Topics we should cover but haven't
   - Audience questions we're not answering
   - Competitor content we should match or beat

5. **Recommendations**
   - Top 5 content priorities for next {{PLANNING_PERIOD}}
   - Specific content ideas with rationale
   - Format and channel recommendations

Present findings in a clear, actionable format.`,
    variables: [
      { key: 'PERFORMANCE_DATA', label: 'Performance Data', placeholder: 'Paste CSV data, analytics summary, or key metrics here', type: 'textarea' },
      { key: 'CONTENT_DETAILS', label: 'Content Details', placeholder: 'List of content titles, topics, and publish dates', type: 'textarea' },
      { key: 'GOAL', label: 'Primary Goal', placeholder: 'Increase organic signups from blog content', type: 'text' },
      { key: 'TIME_PERIOD', label: 'Time Period', placeholder: 'Last 90 days', type: 'text' },
      { key: 'PLANNING_PERIOD', label: 'Planning Period', placeholder: 'quarter', type: 'text' },
    ],
  },
  {
    id: 'competitor-analysis',
    title: 'Competitive Intelligence Report',
    description: 'Analyze competitor content, messaging, and positioning.',
    category: 'Analysis & Strategy',
    icon: '🔍',
    outputType: 'general',
    template: `Create a competitive intelligence report for TaxDrop.

**Competitors to Analyze:**
{{COMPETITORS}}

**Competitor Materials/URLs:**
{{MATERIALS}}

**Analysis Dimensions:**

1. **Positioning & Messaging**
   - How do they position themselves?
   - What's their primary value proposition?
   - What language/terminology do they use?

2. **Pricing & Business Model**
   - How do they charge (contingency %, flat fee, etc.)?
   - What's included in their service?
   - Any guarantees or promises?

3. **Content Strategy**
   - What topics do they cover?
   - What formats do they use?
   - How often do they publish?
   - What's their SEO strategy?

4. **Target Audience**
   - Who are they targeting?
   - What pain points do they address?
   - How do they segment their audience?

5. **Strengths & Weaknesses**
   - What do they do well?
   - Where do they fall short?
   - What opportunities do they miss?

**TaxDrop Context:**
- We're a property tax protest/appeal service
- 25% contingency fee, no fee if savings < $500
- Focused on Texas and California
- Our differentiator: {{DIFFERENTIATOR}}

**Output:**
- Executive summary
- Competitor-by-competitor breakdown
- Comparison matrix
- Opportunities for TaxDrop to exploit
- Threats to address`,
    variables: [
      { key: 'COMPETITORS', label: 'Competitors', placeholder: 'NTPTS, Ownwell, Home Tax Shield', type: 'text' },
      { key: 'MATERIALS', label: 'Competitor Materials', placeholder: 'URLs, screenshots, or paste their content here', type: 'textarea' },
      { key: 'DIFFERENTIATOR', label: 'Our Differentiator', placeholder: 'Expert-driven appeals with local market knowledge + tech-enabled process', type: 'text' },
    ],
  },
  {
    id: 'keyword-strategy',
    title: 'Keyword Strategy Developer',
    description: 'Develop a comprehensive keyword strategy from research data.',
    category: 'Analysis & Strategy',
    icon: '🎯',
    outputType: 'general',
    template: `Develop a keyword strategy for TaxDrop based on the following research.

**Keyword Research Data:**
{{KEYWORD_DATA}}

**Business Context:**
- Service: Property tax protest (TX) / appeal (CA)
- Target States: Texas, California
- Target Audience: {{AUDIENCE}}
- Primary Goal: {{GOAL}}

**Current Rankings (if available):**
{{CURRENT_RANKINGS}}

**Analysis Required:**

1. **Keyword Categorization**
   - Informational (how to, what is, etc.)
   - Transactional (service, help, company, etc.)
   - Local (county-specific, city-specific)
   - Comparison (vs, alternative, review)

2. **Priority Keywords**
   - High volume + high intent (immediate targets)
   - Low competition opportunities (quick wins)
   - Long-tail opportunities (content ideas)

3. **Content Mapping**
   - Which keywords map to which page types?
   - Blog post opportunities
   - Landing page opportunities
   - Glossary term opportunities

4. **Geographic Strategy**
   - State-level keywords
   - County-level keywords (prioritize by population)
   - City-level keywords (if relevant)

5. **Content Calendar Implications**
   - Seasonal keyword opportunities (deadline periods)
   - Evergreen content priorities
   - Quick wins vs long-term plays

**Output Format:**
- Priority keyword list with metrics
- Content recommendations for top 20 keywords
- 90-day action plan`,
    variables: [
      { key: 'KEYWORD_DATA', label: 'Keyword Research Data', placeholder: 'Paste keyword data from NeuronWriter, Ahrefs, etc.', type: 'textarea' },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Homeowners and landlords concerned about rising property taxes', type: 'text' },
      { key: 'GOAL', label: 'Primary Goal', placeholder: 'Rank #1-3 for high-intent property tax protest keywords', type: 'text' },
      { key: 'CURRENT_RANKINGS', label: 'Current Rankings', placeholder: 'List current keyword positions if known', type: 'textarea' },
    ],
  },
  // Repurposing
  {
    id: 'content-repurpose',
    title: 'Content Repurposing Pipeline',
    description: 'Transform one piece of content into multiple formats for different channels.',
    category: 'Repurposing',
    icon: '♻️',
    outputType: 'social',
    template: `Repurpose the following content for multiple channels.

**Source Content:**
{{SOURCE_CONTENT}}

**Source Type:** {{SOURCE_TYPE}}
**Source Topic:** {{TOPIC}}

**Repurpose Into:**

{{CHANNELS}}

**Voice Guidelines:**
- TaxDrop brand voice: friendly, knowledgeable, confident
- Adapt tone for each platform (more professional for LinkedIn, casual for social)
- Never salesy or pushy
- Focus on value and education

**Key Messages to Preserve:**
{{KEY_MESSAGES}}

**Requirements:**
- Don't just shorten - actually reframe for each channel's audience
- Include platform-appropriate CTAs
- Add relevant hashtags where appropriate
- Maintain accuracy of any stats or facts

**Output Format:**
Organize by channel with clear labels:

## LinkedIn
[Post 1]
[Post 2]
etc.

## Twitter/X
[Thread 1]
[Thread 2]
etc.

Continue for each channel...`,
    variables: [
      { key: 'SOURCE_CONTENT', label: 'Source Content', placeholder: 'Paste the full content to repurpose (blog post, transcript, etc.)', type: 'textarea' },
      { key: 'SOURCE_TYPE', label: 'Source Type', placeholder: 'Blog post', type: 'select', options: ['Blog post', 'Podcast transcript', 'Webinar transcript', 'Video script', 'Email', 'Report'] },
      { key: 'TOPIC', label: 'Topic', placeholder: 'How to file a property tax protest before the May 15 deadline', type: 'text' },
      { key: 'CHANNELS', label: 'Target Channels', placeholder: '- LinkedIn: 3 posts highlighting different insights\n- Twitter/X: 1 thread breaking down key points\n- Email newsletter: Summary with link to full article\n- Instagram: 2 carousel post scripts', type: 'textarea' },
      { key: 'KEY_MESSAGES', label: 'Key Messages', placeholder: '- May 15 deadline is approaching\n- 30-60% of properties are overassessed\n- Takes less than 2 minutes to start', type: 'textarea' },
    ],
  },
  {
    id: 'video-script',
    title: 'Video Script Generator',
    description: 'Create scripts for YouTube, TikTok, or Reels from existing content.',
    category: 'Repurposing',
    icon: '🎬',
    outputType: 'general',
    template: `Create a video script for TaxDrop.

**Video Type:** {{VIDEO_TYPE}}
**Platform:** {{PLATFORM}}
**Target Length:** {{LENGTH}}
**Topic:** {{TOPIC}}

**Source Material (optional):**
{{SOURCE}}

**Script Requirements:**

**Hook (First 3 seconds):**
- Stop the scroll
- Create curiosity or address pain point
- Examples: "You're probably overpaying on property taxes" or "What if I told you that you could save $1,000+ on your property taxes?"

**Body:**
- Clear, simple language
- One idea per sentence
- Conversational tone (like talking to a friend)
- Include specific numbers when possible

**CTA:**
- Clear next step
- TaxDrop mention
- "Link in bio" or specific action

**Visual/B-Roll Notes:**
- Include suggestions for visuals
- Mark any text overlays
- Note any transitions

**Tone:**
- {{TONE}}

**Format the script as:**
[VISUAL] | [AUDIO/DIALOGUE] | [TEXT OVERLAY]

Create {{VARIATION_COUNT}} variations if requested.`,
    variables: [
      { key: 'VIDEO_TYPE', label: 'Video Type', placeholder: 'Educational explainer', type: 'select', options: ['Educational explainer', 'Testimonial-style', 'Behind the scenes', 'Quick tip', 'Myth buster', 'How-to tutorial'] },
      { key: 'PLATFORM', label: 'Platform', placeholder: 'TikTok/Reels', type: 'select', options: ['YouTube (long-form)', 'YouTube Shorts', 'TikTok/Reels', 'LinkedIn Video'] },
      { key: 'LENGTH', label: 'Target Length', placeholder: '60 seconds', type: 'text' },
      { key: 'TOPIC', label: 'Topic', placeholder: '3 signs you\'re overpaying on property taxes', type: 'text' },
      { key: 'SOURCE', label: 'Source Material', placeholder: 'Paste any reference content, stats, or talking points', type: 'textarea' },
      { key: 'TONE', label: 'Tone', placeholder: 'Friendly expert - like a helpful neighbor who knows about taxes', type: 'text' },
      { key: 'VARIATION_COUNT', label: 'Number of Variations', placeholder: '1', type: 'text' },
    ],
  },
  // Outreach & Sales
  {
    id: 'partner-outreach',
    title: 'Partner Outreach Email',
    description: 'Create personalized outreach emails for potential partners.',
    category: 'Outreach & Sales',
    icon: '🤝',
    outputType: 'email',
    template: `Create personalized partner outreach emails for TaxDrop.

**Partner Type:** {{PARTNER_TYPE}}
**Number of Emails:** {{EMAIL_COUNT}}

**Partner Information:**
{{PARTNER_INFO}}

**TaxDrop Partnership Offer:**
- $20 commission per successful referral
- White-label option available
- Co-marketing opportunities
- {{ADDITIONAL_OFFER}}

**Email Requirements:**
- Personalized opening (not generic flattery)
- Clear value proposition for THEM
- Under 150 words
- Single clear CTA
- Professional but friendly tone

**CTA:** {{CTA}}

**Do NOT:**
- Sound like a template
- Be overly formal
- Lead with "I" statements
- Make it about us

**DO:**
- Reference something specific about them
- Show you understand their business
- Lead with value to them
- Make responding easy

**Format each email:**
---
**To:** [Partner Name] at [Company]
**Subject:** [Subject Line]

[Email Body]

---`,
    variables: [
      { key: 'PARTNER_TYPE', label: 'Partner Type', placeholder: 'Real Estate Agents', type: 'select', options: ['Real Estate Agents', 'Mortgage Brokers', 'Financial Advisors', 'CPAs/Accountants', 'Property Managers', 'Title Companies', 'Home Inspectors'] },
      { key: 'EMAIL_COUNT', label: 'Number of Emails', placeholder: '5', type: 'text' },
      { key: 'PARTNER_INFO', label: 'Partner Information', placeholder: 'List names, companies, and any relevant details about each partner', type: 'textarea' },
      { key: 'ADDITIONAL_OFFER', label: 'Additional Offer', placeholder: 'Free property tax analysis for their clients', type: 'text' },
      { key: 'CTA', label: 'Call to Action', placeholder: 'Book a 15-minute call to discuss partnership', type: 'text' },
    ],
  },
  {
    id: 'testimonial-request',
    title: 'Testimonial Request Sequence',
    description: 'Create emails to request testimonials from happy customers.',
    category: 'Outreach & Sales',
    icon: '⭐',
    outputType: 'email',
    template: `Create a testimonial request email sequence for TaxDrop.

**Customer Segment:** {{SEGMENT}}
**Average Savings:** {{SAVINGS}}
**Timing:** {{TIMING}}

**Sequence:**

**Email 1: Initial Ask**
- Congratulate on savings
- Simple ask for feedback
- Make it easy (provide questions)
- Offer incentive if applicable: {{INCENTIVE}}

**Email 2: Follow-up (if no response)**
- Gentle reminder
- Emphasize how it helps others
- Offer alternative (Google review, video call, etc.)

**Questions to Include:**
1. What made you decide to try TaxDrop?
2. How was your experience with the process?
3. What would you tell a friend who's unsure about protesting their property taxes?
4. How do you plan to use your savings?

**Tone:**
- Grateful, not demanding
- Personal, not automated-feeling
- Brief and respectful of their time

**Format Options to Offer:**
- Written testimonial (easiest)
- Google/Trustpilot review
- Quick video call (we'll handle editing)
- Case study interview

**Subject Line Options:**
{{SUBJECT_OPTIONS}}`,
    variables: [
      { key: 'SEGMENT', label: 'Customer Segment', placeholder: 'Customers who saved $1,000+ in Harris County', type: 'text' },
      { key: 'SAVINGS', label: 'Average Savings', placeholder: '$1,500', type: 'text' },
      { key: 'TIMING', label: 'Timing', placeholder: '2 weeks after successful protest result', type: 'text' },
      { key: 'INCENTIVE', label: 'Incentive (optional)', placeholder: '$25 Amazon gift card', type: 'text' },
      { key: 'SUBJECT_OPTIONS', label: 'Subject Line Options', placeholder: 'Quick favor?\nYour $X savings story\nHelp other homeowners like you', type: 'textarea' },
    ],
  },
  // Research & Planning
  {
    id: 'content-brief',
    title: 'Content Brief Generator',
    description: 'Create detailed content briefs for writers or yourself.',
    category: 'Research & Planning',
    icon: '📋',
    outputType: 'general',
    template: `Create a detailed content brief for TaxDrop.

**Content Type:** {{CONTENT_TYPE}}
**Topic:** {{TOPIC}}
**Target Keyword:** {{KEYWORD}}
**Target Word Count:** {{WORD_COUNT}}

**Search Intent:** {{INTENT}}

**Target Audience:**
{{AUDIENCE}}

**Competitor Content to Beat:**
{{COMPETITORS}}

**Brief Should Include:**

1. **Working Title Options** (3-5 options)

2. **Target Keyword + Secondaries**
   - Primary: [keyword]
   - Secondary: [list]
   - Questions to answer: [list]

3. **Search Intent Analysis**
   - What is the searcher trying to accomplish?
   - What stage of awareness are they in?

4. **Content Outline**
   - H1
   - H2s with brief description of what to cover
   - H3s where needed

5. **Key Points to Cover**
   - Must-include information
   - Stats to reference
   - Examples to use

6. **Internal Links**
   - Pages to link to
   - Anchor text suggestions

7. **CTA Strategy**
   - Primary CTA
   - Secondary CTA
   - Placement recommendations

8. **SEO Requirements**
   - Meta title (under 60 chars)
   - Meta description (under 160 chars)
   - URL slug suggestion

9. **Style Notes**
   - Tone guidance
   - Formatting preferences
   - Things to avoid

**State Context:** {{STATE}}`,
    variables: [
      { key: 'CONTENT_TYPE', label: 'Content Type', placeholder: 'Blog post', type: 'select', options: ['Blog post', 'Landing page', 'Glossary term', 'Guide/Ebook', 'Email'] },
      { key: 'TOPIC', label: 'Topic', placeholder: 'How to file a property tax protest in Harris County', type: 'text' },
      { key: 'KEYWORD', label: 'Target Keyword', placeholder: 'Harris County property tax protest', type: 'text' },
      { key: 'WORD_COUNT', label: 'Target Word Count', placeholder: '1500-2000', type: 'text' },
      { key: 'INTENT', label: 'Search Intent', placeholder: 'Informational - user wants to learn the process', type: 'select', options: ['Informational', 'Transactional', 'Navigational', 'Commercial'] },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Harris County homeowners who just received their assessment notice and want to protest', type: 'textarea' },
      { key: 'COMPETITORS', label: 'Competitor URLs', placeholder: 'URLs of top-ranking content to analyze and beat', type: 'textarea' },
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
    ],
  },
  {
    id: 'weekly-content-plan',
    title: 'Weekly Content Plan',
    description: 'Plan your content for the week across all channels.',
    category: 'Research & Planning',
    icon: '📅',
    outputType: 'general',
    template: `Create a weekly content plan for TaxDrop.

**Week of:** {{WEEK_OF}}
**Primary Focus:** {{FOCUS}}
**Key Dates/Deadlines:** {{DEADLINES}}

**Available Resources:**
{{RESOURCES}}

**Channels to Plan:**
{{CHANNELS}}

**Content Themes This Week:**
{{THEMES}}

**Create a plan that includes:**

**Monday - Friday Breakdown:**
For each day, specify:
- Channel
- Content type
- Topic/angle
- Key message
- CTA
- Publish time

**Content Calendar Format:**
| Day | Channel | Type | Topic | Status |
|-----|---------|------|-------|--------|

**Notes:**
- Balance educational vs promotional (80/20 rule)
- Consider seasonal relevance (deadlines, etc.)
- Ensure variety in formats
- Plan for engagement/community management

**Capacity Check:**
- Total pieces: X
- Writing needed: X
- Design needed: X
- Is this realistic? Y/N

**Success Metrics to Track:**
{{METRICS}}`,
    variables: [
      { key: 'WEEK_OF', label: 'Week Of', placeholder: 'January 15, 2024', type: 'text' },
      { key: 'FOCUS', label: 'Primary Focus', placeholder: 'Texas protest deadline awareness', type: 'text' },
      { key: 'DEADLINES', label: 'Key Dates', placeholder: 'May 15 - Texas protest deadline\nMay 1 - Push campaign starts', type: 'textarea' },
      { key: 'RESOURCES', label: 'Available Resources', placeholder: '- 2 blog posts ready\n- 1 case study to share\n- New savings stats', type: 'textarea' },
      { key: 'CHANNELS', label: 'Channels', placeholder: 'Blog, LinkedIn, Facebook, Email, Twitter', type: 'text' },
      { key: 'THEMES', label: 'Content Themes', placeholder: '- Deadline urgency\n- Success stories\n- How-to guides', type: 'textarea' },
      { key: 'METRICS', label: 'Success Metrics', placeholder: 'Blog traffic, social engagement, email signups', type: 'text' },
    ],
  },
  // Advertising
  {
    id: 'google-ads-search',
    title: 'Google Search Ads',
    description: 'Create high-converting Google Search ad copy with headlines, descriptions, and extensions.',
    category: 'Advertising',
    icon: '🎯',
    outputType: 'general',
    template: `Create Google Search Ads for TaxDrop's property tax protest/appeal service.

**Campaign Focus:** {{CAMPAIGN_FOCUS}}
**Target State:** {{STATE}}
**Target Keywords:** {{KEYWORDS}}
**Landing Page:** {{LANDING_PAGE}}

**TaxDrop Value Props:**
- 25% contingency fee (only pay if we save you money)
- No fee if savings are under $500
- 30-60% of properties are over-assessed
- Takes less than 2 minutes to start
- Expert-driven appeals with local market knowledge

**Create the following ad components:**

**Responsive Search Ad 1 (Primary)**
Headlines (15 max, 30 chars each):
- 5 benefit-focused headlines
- 3 urgency/deadline headlines
- 3 credibility headlines
- 2 CTA headlines
- 2 keyword-focused headlines

Descriptions (4 max, 90 chars each):
- 2 benefit-focused descriptions
- 2 CTA descriptions

**Responsive Search Ad 2 (Variant)**
Different angle/messaging for A/B testing

**Ad Extensions:**

Sitelinks (4):
- Title (25 chars) + Description (35 chars each)

Callouts (4):
- 25 chars each, highlight key benefits

Structured Snippets:
- Header: Services
- Values: List 3-4 service aspects

**State-Specific Notes:**
- Texas: Use "protest" terminology, reference May 15 deadline
- California: Use "appeal" terminology, reference assessment cycle

**Tone:**
- Confident and direct
- Urgency without being pushy
- Focus on savings and ease
- Never use "cheap" or "discount"`,
    variables: [
      { key: 'CAMPAIGN_FOCUS', label: 'Campaign Focus', placeholder: 'Deadline awareness / General awareness / Retargeting', type: 'select', options: ['Deadline Awareness', 'General Awareness', 'High-Intent Keywords', 'Competitor Targeting', 'Retargeting'] },
      { key: 'STATE', label: 'Target State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California', 'Both'] },
      { key: 'KEYWORDS', label: 'Target Keywords', placeholder: 'property tax protest, lower property taxes, property tax appeal', type: 'textarea' },
      { key: 'LANDING_PAGE', label: 'Landing Page', placeholder: 'https://taxdrop.com/texas or specific county page', type: 'text' },
    ],
  },
  {
    id: 'google-ads-display',
    title: 'Google Display Ads',
    description: 'Create compelling display ad copy for banner ads and responsive display campaigns.',
    category: 'Advertising',
    icon: '🖼️',
    outputType: 'general',
    template: `Create Google Display Ad copy for TaxDrop.

**Campaign Objective:** {{OBJECTIVE}}
**Target Audience:** {{AUDIENCE}}
**Target State:** {{STATE}}

**TaxDrop Context:**
- Property tax protest (TX) / appeal (CA) service
- 25% contingency fee, no upfront cost
- No fee if savings < $500
- 30-60% of properties over-assessed
- Takes < 2 minutes to start

**Create copy for these ad sizes:**

**Responsive Display Ad:**
Short Headline (30 chars):
Long Headline (90 chars):
Description (90 chars):
Business Name: TaxDrop

**Leaderboard (728x90):**
Headline:
Body:
CTA:

**Medium Rectangle (300x250):**
Headline:
Body:
CTA:

**Large Rectangle (336x280):**
Headline:
Subheadline:
Body:
CTA:

**Skyscraper (160x600):**
Headline:
Body Lines (3):
CTA:

**Mobile Banner (320x50):**
Headline + CTA (very short):

**Creative Direction:**
- Use TaxDrop brand colors: Deep Emerald (#0C593E), Mint (#DFFFEA), Yellow-Green (#C4FF64)
- Include savings amount where possible (e.g., "Save $1,000+ on Property Taxes")
- Urgency messaging for deadline campaigns
- Show before/after or savings visualization concepts

**Visual Concepts (describe 3):**
1. [Concept with homeowner focus]
2. [Concept with savings focus]
3. [Concept with urgency focus]`,
    variables: [
      { key: 'OBJECTIVE', label: 'Campaign Objective', placeholder: 'Brand Awareness', type: 'select', options: ['Brand Awareness', 'Lead Generation', 'Deadline Push', 'Retargeting'] },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Homeowners 35-65, interested in finance and home improvement', type: 'text' },
      { key: 'STATE', label: 'Target State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California', 'Both'] },
    ],
  },
  {
    id: 'google-ads-performance-max',
    title: 'Performance Max Campaign',
    description: 'Create asset groups for Google Performance Max campaigns across all channels.',
    category: 'Advertising',
    icon: '🚀',
    outputType: 'general',
    template: `Create a Performance Max campaign asset group for TaxDrop.

**Campaign Goal:** {{GOAL}}
**Target Location:** {{LOCATION}}
**Budget Level:** {{BUDGET}}

**TaxDrop Service:**
- Property tax protest (Texas) / appeal (California)
- 25% contingency fee
- No fee if savings under $500
- Expert-driven with local market knowledge

**Asset Group: {{ASSET_GROUP_NAME}}**

**Text Assets:**

Headlines (5, max 30 chars each):
1.
2.
3.
4.
5.

Long Headlines (5, max 90 chars each):
1.
2.
3.
4.
5.

Descriptions (5, max 90 chars each):
1.
2.
3.
4.
5.

**Call to Action:** {{CTA}}

**Image Concepts (describe for designer):**

Landscape (1.91:1) - 3 concepts:
1.
2.
3.

Square (1:1) - 3 concepts:
1.
2.
3.

Portrait (4:5) - 2 concepts:
1.
2.

**Video Concepts (15-30 sec):**

Concept 1: [Hook + Problem + Solution + CTA]
Concept 2: [Testimonial style]
Concept 3: [Before/After savings]

**Audience Signals:**
- Custom segments to target
- In-market audiences
- Affinity audiences
- Demographics

**Final URL:** {{LANDING_PAGE}}

**Sitelinks (4):**
1.
2.
3.
4. `,
    variables: [
      { key: 'GOAL', label: 'Campaign Goal', placeholder: 'Lead Generation', type: 'select', options: ['Lead Generation', 'Brand Awareness', 'Website Traffic'] },
      { key: 'LOCATION', label: 'Target Location', placeholder: 'Texas - Major metros', type: 'text' },
      { key: 'BUDGET', label: 'Budget Level', placeholder: 'Medium ($50-100/day)', type: 'select', options: ['Low ($20-50/day)', 'Medium ($50-100/day)', 'High ($100-250/day)', 'Enterprise ($250+/day)'] },
      { key: 'ASSET_GROUP_NAME', label: 'Asset Group Name', placeholder: 'Texas Homeowners - Deadline', type: 'text' },
      { key: 'CTA', label: 'Call to Action', placeholder: 'Get Your Free Estimate', type: 'select', options: ['Get Your Free Estimate', 'Start Your Protest', 'See Your Savings', 'Learn More', 'Get Started'] },
      { key: 'LANDING_PAGE', label: 'Landing Page URL', placeholder: 'https://taxdrop.com/texas', type: 'text' },
    ],
  },
  // Landing Pages
  {
    id: 'landing-page-copy',
    title: 'Landing Page Copy',
    description: 'Create complete landing page copy with hero, benefits, social proof, and CTAs.',
    category: 'Landing Pages',
    icon: '📄',
    outputType: 'general',
    template: `Create landing page copy for TaxDrop.

**Page Purpose:** {{PURPOSE}}
**Target Audience:** {{AUDIENCE}}
**Target State:** {{STATE}}
**Traffic Source:** {{TRAFFIC_SOURCE}}

**TaxDrop Value Props:**
- 25% contingency fee (only pay if we save you money)
- No fee if savings under $500
- 30-60% of properties are over-assessed
- Only 5% of homeowners actually appeal
- Takes less than 2 minutes to start
- Expert-driven with local market knowledge

**Page Structure:**

## Hero Section
**Headline:** [Outcome-focused, addresses pain point]
**Subheadline:** [Supports headline, adds specificity]
**CTA Button:** [Action-oriented]
**Supporting Text:** [Risk reversal / guarantee]

## Problem Section
**Headline:** [Acknowledge the problem]
**Body:** [3-4 sentences empathizing with the problem]
**Stats to include:**
- 30-60% of properties over-assessed
- Only 5% of owners appeal
- Average savings potential

## Solution Section
**Headline:** [Introduce TaxDrop as the solution]
**How It Works (3 steps):**
1. [Step 1 with icon suggestion]
2. [Step 2 with icon suggestion]
3. [Step 3 with icon suggestion]

## Benefits Section
**Headline:** [Why choose TaxDrop]
**Benefit 1:** [Headline + 2-3 sentences]
**Benefit 2:** [Headline + 2-3 sentences]
**Benefit 3:** [Headline + 2-3 sentences]
**Benefit 4:** [Headline + 2-3 sentences]

## Social Proof Section
**Headline:** [Trust-building]
**Testimonial Framework:** [What to include in testimonials]
**Stats to display:**
- Number of successful protests/appeals
- Average savings amount
- Success rate

## Objection Handling Section
**FAQ Items (5):**
1. Q: [Common objection]
   A: [Response]
2-5. [Continue pattern]

## Final CTA Section
**Headline:** [Urgency + benefit]
**Subheadline:** [Risk reversal]
**CTA Button:** [Same as hero for consistency]
**Supporting elements:** [Trust badges, guarantee]

## Footer Notes
**Compliance text if needed**
**Contact information**

**Tone Guidelines:**
- Conversational and confident
- Never salesy or pushy
- Focus on savings and ease
- Use "protest" for Texas, "appeal" for California`,
    variables: [
      { key: 'PURPOSE', label: 'Page Purpose', placeholder: 'Lead generation for Texas homeowners', type: 'text' },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Texas homeowners who received their assessment notice', type: 'text' },
      { key: 'STATE', label: 'Target State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'TRAFFIC_SOURCE', label: 'Traffic Source', placeholder: 'Google Ads', type: 'select', options: ['Google Ads', 'Facebook Ads', 'Organic Search', 'Email', 'Partner Referral', 'Direct'] },
    ],
  },
  {
    id: 'landing-page-county',
    title: 'County Landing Page',
    description: 'Create localized landing page copy for specific county pages.',
    category: 'Landing Pages',
    icon: '📍',
    outputType: 'general',
    template: `Create county-specific landing page copy for TaxDrop.

**County:** {{COUNTY}}
**State:** {{STATE}}
**County Seat/Major City:** {{MAJOR_CITY}}

**TaxDrop Context:**
- Property tax protest (TX) / appeal (CA) service
- 25% contingency fee
- No fee if savings < $500
- Local expertise in this county

**Research to Include:**
- County appraisal district name (TX) or assessor's office (CA)
- Protest/appeal deadline for this county
- Any county-specific stats if available

**Page Structure:**

## Hero Section
**Headline:** [County-specific, outcome-focused]
**Subheadline:** [Local relevance + TaxDrop benefit]
**CTA:** Start Your [County] Property Tax {{PROTEST_OR_APPEAL}}

## Local Context Section
**Headline:** [Acknowledge local property tax situation]
**Body:** [2-3 paragraphs about property taxes in this county]
- Reference local appraisal district/assessor
- Mention common over-assessment issues
- Local deadline information

## How TaxDrop Helps [County] Homeowners
**3-step process localized:**
1. Enter your [County] property address
2. We analyze your assessment vs. comparable [County] properties
3. Our experts handle your {{PROTEST_OR_APPEAL}} with [Appraisal District/Assessor]

## Why [County] Properties Get Over-Assessed
**Common reasons specific to this area:**
- [Reason 1]
- [Reason 2]
- [Reason 3]

## [County] Property Tax Savings Examples
**Framework for testimonials/case studies:**
- Neighborhood: [Example area]
- Original Assessment: $XXX,XXX
- Reduced To: $XXX,XXX
- Annual Savings: $X,XXX

## [County] Property Tax FAQ
**5 county-specific questions:**
1. When is the {{PROTEST_OR_APPEAL}} deadline in [County]?
2. How do I {{PROTEST_OR_APPEAL}} my property taxes in [County]?
3. What evidence do I need for a [County] property tax {{PROTEST_OR_APPEAL}}?
4. How long does the {{PROTEST_OR_APPEAL}} process take in [County]?
5. What if my {{PROTEST_OR_APPEAL}} is denied in [County]?

## Final CTA
**Headline:** Ready to Lower Your [County] Property Taxes?
**CTA:** Get Your Free [County] Property Analysis

**SEO Elements:**
**Title Tag:** (60 chars)
**Meta Description:** (160 chars)
**H1:**
**URL Slug:** /{{STATE_ABBREV}}/{{COUNTY_SLUG}}`,
    variables: [
      { key: 'COUNTY', label: 'County Name', placeholder: 'Harris County', type: 'text' },
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'MAJOR_CITY', label: 'Major City', placeholder: 'Houston', type: 'text' },
      { key: 'PROTEST_OR_APPEAL', label: 'Protest or Appeal', placeholder: 'Protest', type: 'select', options: ['Protest', 'Appeal'] },
      { key: 'STATE_ABBREV', label: 'State Abbreviation', placeholder: 'texas', type: 'select', options: ['texas', 'california'] },
      { key: 'COUNTY_SLUG', label: 'County URL Slug', placeholder: 'harris-county', type: 'text' },
    ],
  },
  {
    id: 'landing-page-ab-variants',
    title: 'Landing Page A/B Variants',
    description: 'Create multiple headline and CTA variants for A/B testing.',
    category: 'Landing Pages',
    icon: '🔬',
    outputType: 'general',
    template: `Create A/B test variants for TaxDrop landing page.

**Current Page:** {{CURRENT_PAGE}}
**Current Headline:** {{CURRENT_HEADLINE}}
**Current CTA:** {{CURRENT_CTA}}
**Conversion Rate:** {{CONVERSION_RATE}}
**Test Goal:** {{TEST_GOAL}}

**TaxDrop Context:**
- Property tax protest/appeal service
- 25% contingency fee
- No fee if savings < $500
- Target: {{TARGET_AUDIENCE}}

**Create {{VARIANT_COUNT}} test variants:**

## Variant A: [Angle Name]
**Hypothesis:** [Why this might work better]
**Headline:**
**Subheadline:**
**CTA Button:**
**Supporting Text:**

## Variant B: [Angle Name]
**Hypothesis:** [Why this might work better]
**Headline:**
**Subheadline:**
**CTA Button:**
**Supporting Text:**

## Variant C: [Angle Name]
**Hypothesis:** [Why this might work better]
**Headline:**
**Subheadline:**
**CTA Button:**
**Supporting Text:**

[Continue for requested number of variants]

**Testing Angles to Consider:**
1. **Savings Focus:** Lead with dollar amount savings
2. **Ease Focus:** Emphasize how simple the process is
3. **Risk Reversal:** Lead with "no fee" guarantee
4. **Urgency Focus:** Deadline-driven messaging
5. **Social Proof:** Lead with success stats
6. **Problem Agitation:** Start with the pain point
7. **Curiosity:** Ask a compelling question
8. **Specificity:** Use exact numbers and percentages

**Recommended Test Priority:**
1. [Which variant to test first and why]
2. [Second priority]
3. [Third priority]

**Success Metrics:**
- Primary: [Conversion rate]
- Secondary: [Time on page, scroll depth, etc.]

**Statistical Significance Note:**
Recommend running test until [X] conversions per variant for reliable results.`,
    variables: [
      { key: 'CURRENT_PAGE', label: 'Current Page URL', placeholder: 'https://taxdrop.com/texas', type: 'text' },
      { key: 'CURRENT_HEADLINE', label: 'Current Headline', placeholder: 'Lower Your Property Taxes or Pay Nothing', type: 'text' },
      { key: 'CURRENT_CTA', label: 'Current CTA', placeholder: 'Get Your Free Estimate', type: 'text' },
      { key: 'CONVERSION_RATE', label: 'Current Conversion Rate', placeholder: '3.5%', type: 'text' },
      { key: 'TEST_GOAL', label: 'Test Goal', placeholder: 'Increase conversion rate by 20%', type: 'text' },
      { key: 'TARGET_AUDIENCE', label: 'Target Audience', placeholder: 'Texas homeowners from Google Ads', type: 'text' },
      { key: 'VARIANT_COUNT', label: 'Number of Variants', placeholder: '3', type: 'select', options: ['2', '3', '4', '5'] },
    ],
  },

  // Video & Multimedia
  {
    id: 'video-script-generator',
    title: 'Video Script Generator',
    description: 'Create engaging video scripts for YouTube, TikTok, or explainer videos.',
    category: 'Video & Multimedia',
    icon: '🎬',
    outputType: 'general',
    template: `Write a {{VIDEO_TYPE}} video script for TaxDrop.

**Topic:** {{TOPIC}}
**Platform:** {{PLATFORM}}
**Target Length:** {{LENGTH}}
**Target Audience:** {{AUDIENCE}}

**TaxDrop Context:**
- Property tax protest (TX) / appeal (CA) service
- 25% contingency fee, no upfront cost
- No fee if savings < $500
- 30-60% of properties are over-assessed
- Only ~5% of homeowners protest/appeal

**Script Requirements:**
- Hook in first 3 seconds (stop the scroll)
- Conversational, friendly tone
- Address pain points: high taxes, confusing process, time-consuming
- Include specific numbers/stats when possible
- End with clear CTA

**Script Structure:**
## HOOK (0-3 seconds)
[Attention-grabbing opener]

## PROBLEM (3-15 seconds)
[Agitate the pain point]

## SOLUTION (15-45 seconds)
[Introduce TaxDrop and how we solve it]

## PROOF (45-60 seconds)
[Stats, social proof, credibility]

## CTA (Final 5-10 seconds)
[Clear next step]

**Visual Notes:**
[Suggest B-roll, graphics, or on-screen text]

**Voiceover/Speaking Notes:**
[Pacing, emphasis, tone cues]

**Additional Context:**
{{ADDITIONAL_CONTEXT}}`,
    variables: [
      { key: 'VIDEO_TYPE', label: 'Video Type', placeholder: 'Explainer', type: 'select', options: ['Explainer', 'Educational', 'Testimonial/Case Study', 'How-To Tutorial', 'Urgency/Deadline', 'FAQ Answer'] },
      { key: 'TOPIC', label: 'Topic', placeholder: 'How to protest your Texas property taxes before the May 15 deadline', type: 'text' },
      { key: 'PLATFORM', label: 'Platform', placeholder: 'YouTube', type: 'select', options: ['YouTube (long-form)', 'YouTube Shorts', 'TikTok', 'Instagram Reels', 'Facebook', 'LinkedIn'] },
      { key: 'LENGTH', label: 'Target Length', placeholder: '60 seconds', type: 'select', options: ['15 seconds', '30 seconds', '60 seconds', '90 seconds', '2-3 minutes', '5-10 minutes'] },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'First-time homeowners in Texas who just got their assessment notice', type: 'text' },
      { key: 'ADDITIONAL_CONTEXT', label: 'Additional Context', placeholder: 'Focus on Harris County deadline, mention success rate', type: 'textarea' },
    ],
  },
  {
    id: 'case-study-writer',
    title: 'Customer Case Study',
    description: 'Turn customer success stories into compelling marketing case studies.',
    category: 'Video & Multimedia',
    icon: '📊',
    outputType: 'general',
    template: `Create a compelling case study for TaxDrop.

**Customer Information:**
- Name/Alias: {{CUSTOMER_NAME}}
- Location: {{LOCATION}}
- Property Type: {{PROPERTY_TYPE}}

**Results:**
- Original Assessed Value: {{ORIGINAL_VALUE}}
- New Assessed Value: {{NEW_VALUE}}
- Tax Savings: {{TAX_SAVINGS}}
- Time to Complete: {{TIMELINE}}

**Customer Quote (if available):**
{{CUSTOMER_QUOTE}}

**Story Context:**
{{STORY_CONTEXT}}

**Output Format:** {{OUTPUT_FORMAT}}

---

**Create the case study with these sections:**

## Headline
[Specific, results-focused headline with numbers]

## Quick Stats Summary
[Visual-friendly stats box]

## The Challenge
- What was the customer facing?
- Why did they feel stuck?
- What had they tried before?

## The Discovery
- How did they find TaxDrop?
- What was their initial hesitation?
- What made them decide to try?

## The Process
- How easy was it to get started?
- What did TaxDrop handle for them?
- How much of their time did it take?

## The Results
- Specific numbers and savings
- Timeline from start to finish
- Impact on their life/finances

## In Their Words
[Customer quote or testimonial]

## Key Takeaways
- 3-4 bullet points summarizing learnings
- How this applies to similar homeowners

## CTA
[Relevant call-to-action for readers in similar situations]

**Writing Guidelines:**
- Use specific numbers (not "thousands saved" but "$2,340 saved")
- Show the emotional journey, not just the transaction
- Make it relatable to other homeowners
- Keep it conversational, not salesy`,
    variables: [
      { key: 'CUSTOMER_NAME', label: 'Customer Name/Alias', placeholder: 'Sarah M. (or "A Houston Homeowner")', type: 'text' },
      { key: 'LOCATION', label: 'Location', placeholder: 'Harris County, Texas', type: 'text' },
      { key: 'PROPERTY_TYPE', label: 'Property Type', placeholder: 'Single-family home', type: 'select', options: ['Single-family home', 'Condo/Townhouse', 'Multi-family property', 'Investment property', 'Vacation home'] },
      { key: 'ORIGINAL_VALUE', label: 'Original Assessed Value', placeholder: '$485,000', type: 'text' },
      { key: 'NEW_VALUE', label: 'New Assessed Value', placeholder: '$412,000', type: 'text' },
      { key: 'TAX_SAVINGS', label: 'Annual Tax Savings', placeholder: '$1,825', type: 'text' },
      { key: 'TIMELINE', label: 'Timeline', placeholder: '6 weeks from signup to resolution', type: 'text' },
      { key: 'CUSTOMER_QUOTE', label: 'Customer Quote', placeholder: '"I had no idea my home was over-assessed by so much. TaxDrop handled everything."', type: 'textarea' },
      { key: 'STORY_CONTEXT', label: 'Story Context', placeholder: 'First-time homeowner who noticed neighbors with similar homes paying less', type: 'textarea' },
      { key: 'OUTPUT_FORMAT', label: 'Output Format', placeholder: 'Blog Post', type: 'select', options: ['Blog Post', 'One-Page PDF', 'Social Media Series', 'Email Campaign', 'Landing Page Section'] },
    ],
  },

  // Customer Communications
  {
    id: 'customer-win-email',
    title: 'Customer Win Notification',
    description: 'Celebrate successful protests/appeals with customers.',
    category: 'Customer Communications',
    icon: '🎉',
    outputType: 'email',
    template: `Write a customer win notification email for TaxDrop.

**Customer Details:**
- First Name: {{CUSTOMER_NAME}}
- State: {{STATE}}
- Original Assessed Value: {{ORIGINAL_VALUE}}
- New Assessed Value: {{NEW_VALUE}}
- Annual Tax Savings: {{TAX_SAVINGS}}
- TaxDrop Fee (25%): {{TAXDROP_FEE}}
- Net Savings: {{NET_SAVINGS}}

**Outcome Type:** {{OUTCOME_TYPE}}

---

**Email Requirements:**
- Subject line that makes them excited to open
- Celebrate their win genuinely
- Clear breakdown of the numbers
- Explain next steps (if any)
- Ask for referral/testimonial (softly)
- Provide helpful context for next year

**Email Structure:**

## Subject Line Options
[3 subject line options]

## Email Body

**Opening:**
[Celebration and congratulations - make them feel like a winner]

**The Good News:**
[Clear presentation of results with numbers]

**What This Means:**
[Context on their savings, comparison to neighbors who didn't protest/appeal]

**What Happens Next:**
[Any remaining steps, when they'll see impact on tax bill]

**One More Thing:**
[Soft ask for testimonial or referral - make it easy with specific link/reply]

**Looking Ahead:**
[Brief note about next year and how TaxDrop will help again]

**Signature:**
[Friendly sign-off from TaxDrop team]

**Tone:** Celebratory, genuine, grateful - not transactional or salesy`,
    variables: [
      { key: 'CUSTOMER_NAME', label: 'Customer First Name', placeholder: 'Michael', type: 'text' },
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'ORIGINAL_VALUE', label: 'Original Assessed Value', placeholder: '$520,000', type: 'text' },
      { key: 'NEW_VALUE', label: 'New Assessed Value', placeholder: '$445,000', type: 'text' },
      { key: 'TAX_SAVINGS', label: 'Annual Tax Savings', placeholder: '$1,875', type: 'text' },
      { key: 'TAXDROP_FEE', label: 'TaxDrop Fee', placeholder: '$469', type: 'text' },
      { key: 'NET_SAVINGS', label: 'Net Savings', placeholder: '$1,406', type: 'text' },
      { key: 'OUTCOME_TYPE', label: 'Outcome Type', placeholder: 'Informal hearing win', type: 'select', options: ['Informal hearing win', 'Formal hearing win', 'ARB settlement', 'Assessment correction', 'Exemption applied'] },
    ],
  },
  {
    id: 'onboarding-sequence',
    title: 'Customer Onboarding Sequence',
    description: 'Welcome new customers and set expectations for the process.',
    category: 'Customer Communications',
    icon: '👋',
    outputType: 'email',
    template: `Create a {{EMAIL_COUNT}}-email onboarding sequence for new TaxDrop customers.

**Customer Segment:** {{SEGMENT}}
**State:** {{STATE}}
**Timeline:** {{TIMELINE}}

**TaxDrop Process Overview:**
1. Customer signs up and enters property info
2. We analyze their property and comparable sales
3. We file the protest/appeal on their behalf
4. We represent them at hearings (if needed)
5. We notify them of results
6. They pay 25% of savings (only if we save $500+)

---

**Sequence Goals:**
- Build confidence they made the right choice
- Set realistic expectations
- Reduce "what's happening?" support inquiries
- Educate them on the process
- Keep them engaged

**Create emails for these milestones:**

## Email 1: Welcome (Day 0)
- Celebrate their decision
- Confirm what we received
- Preview what happens next
- Set expectations for timeline

## Email 2: Analysis Underway (Day 3)
- What we're analyzing
- Types of evidence we gather
- Quick education on how assessments work

## Email 3: Case Filed (When filed)
- Confirmation of filing
- What the appraisal district/assessor will do next
- Timeline for hearing or response

## Email 4: Hearing Prep (If applicable)
- What to expect at hearing
- What we'll do on their behalf
- Any information we need from them

## Email 5: Results & Next Steps (After resolution)
- Clear outcome summary
- Celebration or next steps
- What happens next year

**Each email should include:**
- Friendly subject line
- Clear, scannable content
- Visual progress indicator concept
- FAQ anticipation
- Easy way to contact support

**Tone:** Professional but warm, confident, educational`,
    variables: [
      { key: 'EMAIL_COUNT', label: 'Number of Emails', placeholder: '5', type: 'select', options: ['3', '4', '5', '6'] },
      { key: 'SEGMENT', label: 'Customer Segment', placeholder: 'First-time protesters', type: 'select', options: ['First-time protesters', 'Returning customers', 'High-value properties', 'Investment properties'] },
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'TIMELINE', label: 'Typical Timeline', placeholder: '4-8 weeks from filing to resolution', type: 'text' },
    ],
  },

  // Sales Enablement
  {
    id: 'objection-handler',
    title: 'Objection Handler Scripts',
    description: 'Create responses to common sales objections and hesitations.',
    category: 'Sales Enablement',
    icon: '🛡️',
    outputType: 'general',
    template: `Create objection handling scripts for TaxDrop sales conversations.

**Context:** {{CONTEXT}}
**Audience:** {{AUDIENCE}}
**Channel:** {{CHANNEL}}

**TaxDrop Key Differentiators:**
- No upfront cost (contingency only)
- No fee if savings < $500
- We handle everything (not DIY tools)
- Local expertise and relationships
- 85% of beta users found $1K+ in savings

---

**Common Objections to Address:**

## "I can do this myself"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## "25% fee is too high"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## "I tried before and it didn't work"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## "My property isn't over-assessed"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## "I'll wait until next year"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## "I don't trust these services"
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

## {{CUSTOM_OBJECTION}}
**Empathy:**
**Reframe:**
**Response:**
**Evidence:**
**Bridge to CTA:**

---

**Response Guidelines:**
- Never argue or get defensive
- Acknowledge their concern as valid
- Use "feel, felt, found" framework
- Include specific numbers/proof points
- Always bridge back to value, not features
- End with soft question, not hard sell`,
    variables: [
      { key: 'CONTEXT', label: 'Context', placeholder: 'Phone sales calls', type: 'select', options: ['Phone sales calls', 'Email responses', 'Live chat', 'Social media DMs', 'In-person conversations'] },
      { key: 'AUDIENCE', label: 'Audience', placeholder: 'Homeowners who started signup but didn\'t complete', type: 'text' },
      { key: 'CHANNEL', label: 'Channel', placeholder: 'Outbound calls to abandoned signups', type: 'text' },
      { key: 'CUSTOM_OBJECTION', label: 'Custom Objection to Address', placeholder: '"What if I sell my house this year?"', type: 'text' },
    ],
  },

  // Campaigns
  {
    id: 'deadline-campaign',
    title: 'Deadline Urgency Campaign',
    description: 'Create a multi-channel campaign for property tax deadlines.',
    category: 'Campaigns',
    icon: '⏰',
    outputType: 'general',
    template: `Create a deadline-driven marketing campaign for TaxDrop.

**Campaign Details:**
- State: {{STATE}}
- Deadline: {{DEADLINE}}
- Days Until Deadline: {{DAYS_REMAINING}}
- Target County/Region: {{REGION}}

**Campaign Goal:** {{GOAL}}
**Budget Level:** {{BUDGET}}

---

**Create campaign assets for:**

## Email Series ({{EMAIL_COUNT}} emails)

### Email 1: Awareness (14 days out)
**Subject:**
**Preview Text:**
**Body Outline:**
**CTA:**

### Email 2: Education (7 days out)
**Subject:**
**Preview Text:**
**Body Outline:**
**CTA:**

### Email 3: Urgency (3 days out)
**Subject:**
**Preview Text:**
**Body Outline:**
**CTA:**

### Email 4: Last Chance (Day of)
**Subject:**
**Preview Text:**
**Body Outline:**
**CTA:**

## Social Media Posts

### 14 Days Out
**Post:**
**Platform Notes:**

### 7 Days Out
**Post:**
**Platform Notes:**

### 3 Days Out
**Post:**
**Platform Notes:**

### Day Of
**Post:**
**Platform Notes:**

## Ad Copy Variants

### Awareness Ad
**Headline:**
**Description:**
**CTA:**

### Urgency Ad
**Headline:**
**Description:**
**CTA:**

### Last Chance Ad
**Headline:**
**Description:**
**CTA:**

## Landing Page Elements
**Headline:**
**Subheadline:**
**Countdown Timer Text:**
**Key Bullet Points:**
**CTA Button:**

---

**Messaging Principles:**
- Create urgency without being manipulative
- Focus on what they'll lose by waiting
- Make the deadline feel real and important
- Show the easy path to beating the deadline
- Use specific county/state references`,
    variables: [
      { key: 'STATE', label: 'State', placeholder: 'Texas', type: 'select', options: ['Texas', 'California'] },
      { key: 'DEADLINE', label: 'Deadline Date', placeholder: 'May 15, 2024', type: 'text' },
      { key: 'DAYS_REMAINING', label: 'Days Until Deadline', placeholder: '14', type: 'text' },
      { key: 'REGION', label: 'Target Region', placeholder: 'Harris County', type: 'text' },
      { key: 'GOAL', label: 'Campaign Goal', placeholder: '500 new signups before deadline', type: 'text' },
      { key: 'BUDGET', label: 'Budget Level', placeholder: 'Medium', type: 'select', options: ['Low (organic only)', 'Medium ($1K-5K)', 'High ($5K+)'] },
      { key: 'EMAIL_COUNT', label: 'Email Count', placeholder: '4', type: 'select', options: ['3', '4', '5', '6'] },
    ],
  },

  // Competitive & PR
  {
    id: 'competitor-comparison',
    title: 'Competitor Comparison Content',
    description: 'Create fair, factual comparison content vs competitors.',
    category: 'Competitive & PR',
    icon: '⚔️',
    outputType: 'general',
    template: `Create comparison content: TaxDrop vs {{COMPETITOR}}.

**Competitor Type:** {{COMPETITOR_TYPE}}
**Content Purpose:** {{PURPOSE}}
**Target Audience:** {{AUDIENCE}}

---

**TaxDrop Overview:**
- Full-service property tax protest/appeal
- 25% contingency fee (no upfront cost)
- No fee if savings < $500
- We handle everything end-to-end
- Expert representation at hearings

**Create comparison content:**

## Fair Comparison Framework

### TaxDrop's Strengths
[Areas where TaxDrop clearly wins]

### Competitor's Strengths
[Be fair - where might they have advantages?]

### Key Differentiators
[What makes TaxDrop unique?]

### When to Choose TaxDrop
[Ideal customer profile for TaxDrop]

### When Competitor Might Make Sense
[Be honest about edge cases]

---

## Comparison Table

| Feature | TaxDrop | {{COMPETITOR}} |
|---------|---------|----------------|
| Pricing Model | | |
| Upfront Cost | | |
| Service Level | | |
| Expert Support | | |
| Success Rate | | |
| Time Required | | |
| Guarantee | | |

---

## FAQ: TaxDrop vs {{COMPETITOR}}

**Q: What's the main difference between TaxDrop and {{COMPETITOR}}?**
A:

**Q: Is TaxDrop more expensive?**
A:

**Q: Which is better for first-time protesters?**
A:

**Q: What if I've used {{COMPETITOR}} before?**
A:

---

## Messaging for Different Channels

### Landing Page Copy
[H1, H2, key bullet points]

### Email to Competitor Users
[Subject line, key message]

### Social Post
[Quick comparison message]

### Sales Script Talking Points
[Key points for conversations]

---

**Guidelines:**
- Be factual and verifiable
- Acknowledge competitor strengths
- Focus on customer outcomes, not feature wars
- Never disparage or use FUD
- Always have evidence for claims`,
    variables: [
      { key: 'COMPETITOR', label: 'Competitor Name', placeholder: 'DIY Property Tax Tools', type: 'text' },
      { key: 'COMPETITOR_TYPE', label: 'Competitor Type', placeholder: 'DIY software', type: 'select', options: ['DIY software', 'Traditional tax consultant', 'Other tech platform', 'Generic service (lawyers/CPAs)'] },
      { key: 'PURPOSE', label: 'Content Purpose', placeholder: 'Landing page for organic search', type: 'select', options: ['Landing page for organic search', 'Sales enablement doc', 'Email to competitor users', 'FAQ/Help center article'] },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'People searching for property tax help options', type: 'text' },
    ],
  },
  {
    id: 'press-release',
    title: 'Press Release Generator',
    description: 'Create press releases for company news, milestones, and announcements.',
    category: 'Competitive & PR',
    icon: '📰',
    outputType: 'general',
    template: `Write a press release for TaxDrop.

**Announcement Type:** {{ANNOUNCEMENT_TYPE}}
**Headline/Topic:** {{HEADLINE}}
**Key Details:** {{KEY_DETAILS}}

**TaxDrop Background:**
- Property tax protest (TX) and appeal (CA) service
- 25% contingency, no upfront cost
- No fee if savings < $500
- Founded to help homeowners fight unfair assessments
- Beta: 85% of users found $1K+ in potential savings

**Quotes From:**
- {{QUOTE_SOURCE_1}}: {{QUOTE_1}}
- {{QUOTE_SOURCE_2}}: {{QUOTE_2}}

---

**Press Release Structure:**

## FOR IMMEDIATE RELEASE

**Contact:**
[Media contact info placeholder]

## HEADLINE
[Compelling, news-worthy headline - 8-12 words]

## SUBHEADLINE
[Supporting detail, location, context]

## DATELINE & LEAD
[City, Date — First paragraph with who, what, where, when, why]

## BODY PARAGRAPH 1
[Expand on the news, key details]

## QUOTE 1
[Quote from company executive with context]

## BODY PARAGRAPH 2
[Additional context, data, impact]

## QUOTE 2
[Quote from partner, customer, or industry expert]

## BODY PARAGRAPH 3
[Future implications, next steps]

## BOILERPLATE
**About TaxDrop**
[Standard company description - 50-75 words]

## CONTACT
[Media contact information]

---

## Additional Assets

### Social Media Announcement
[LinkedIn post version]

### Email to Stakeholders
[Brief email version for investors, partners]

### Internal Announcement
[Brief for team/employees]`,
    variables: [
      { key: 'ANNOUNCEMENT_TYPE', label: 'Announcement Type', placeholder: 'Milestone', type: 'select', options: ['Funding Round', 'Product Launch', 'Partnership', 'Milestone', 'Market Expansion', 'Leadership Hire', 'Customer Success', 'Industry Report'] },
      { key: 'HEADLINE', label: 'Main Headline/Topic', placeholder: 'TaxDrop Helps Texas Homeowners Save $5M in Property Taxes', type: 'text' },
      { key: 'KEY_DETAILS', label: 'Key Details', placeholder: 'Reached 10,000 customers, average savings of $1,500 per household', type: 'textarea' },
      { key: 'QUOTE_SOURCE_1', label: 'Quote Source 1', placeholder: 'Ryder Meehan, CEO', type: 'text' },
      { key: 'QUOTE_1', label: 'Quote 1', placeholder: 'Homeowners deserve a fair assessment...', type: 'textarea' },
      { key: 'QUOTE_SOURCE_2', label: 'Quote Source 2 (optional)', placeholder: 'Industry expert or partner', type: 'text' },
      { key: 'QUOTE_2', label: 'Quote 2 (optional)', placeholder: '', type: 'textarea' },
    ],
  },

  // Advanced AI Prompts (Opus 4.5 Optimized)
  {
    id: 'market-analysis',
    title: 'Property Tax Market Analysis',
    description: 'Generate deep market analysis for specific counties or regions.',
    category: 'Research & Analysis',
    icon: '🔬',
    outputType: 'general',
    template: `Conduct a comprehensive property tax market analysis.

**Target Market:** {{MARKET}}
**Analysis Purpose:** {{PURPOSE}}
**Data Sources Available:** {{DATA_SOURCES}}

---

**Analysis Framework:**

## 1. Market Overview
- Total property count and types
- Assessment methodology used
- Historical assessment trends
- Recent policy changes

## 2. Protest/Appeal Landscape
- Historical protest rates
- Success rates by property type
- Common reduction percentages
- Hearing board tendencies

## 3. Opportunity Assessment
- Properties most likely over-assessed
- Neighborhoods with assessment anomalies
- Property types with highest win rates
- Optimal timing considerations

## 4. Competitive Environment
- Existing protest services
- DIY resources available
- Legal/consultant options
- Market saturation assessment

## 5. Customer Persona Analysis
- Primary homeowner demographics
- Awareness of protest rights
- Previous protest behavior
- Communication preferences

## 6. Strategic Recommendations
- Priority neighborhoods/zip codes
- Optimal marketing messages
- Pricing considerations
- Partnership opportunities

## 7. Risk Factors
- Political/policy changes
- Economic conditions
- Competitive threats
- Regulatory considerations

---

**Output Formats:**
- Executive summary (1 page)
- Detailed analysis (5-10 pages)
- Data tables and visualizations
- Action items and next steps

**Additional Context:**
{{ADDITIONAL_CONTEXT}}`,
    variables: [
      { key: 'MARKET', label: 'Target Market', placeholder: 'Travis County, Texas (Austin metro)', type: 'text' },
      { key: 'PURPOSE', label: 'Analysis Purpose', placeholder: 'Market entry assessment', type: 'select', options: ['Market entry assessment', 'Expansion planning', 'Competitive positioning', 'Marketing strategy', 'Investor presentation'] },
      { key: 'DATA_SOURCES', label: 'Data Sources Available', placeholder: 'County appraisal records, GSC data, customer data', type: 'textarea' },
      { key: 'ADDITIONAL_CONTEXT', label: 'Additional Context', placeholder: 'Focus on single-family homes $300K-$800K', type: 'textarea' },
    ],
  },
  {
    id: 'deep-research-brief',
    title: 'Deep Research Brief',
    description: 'Generate comprehensive research briefs on property tax topics.',
    category: 'Research & Analysis',
    icon: '📚',
    outputType: 'general',
    template: `Create a comprehensive research brief on {{TOPIC}}.

**Research Purpose:** {{PURPOSE}}
**Target Audience:** {{AUDIENCE}}
**Depth Required:** {{DEPTH}}

---

**Research Framework:**

## Executive Summary
[Key findings in 3-5 bullet points]

## Background & Context
- Historical context
- Current state of affairs
- Why this matters now

## Key Findings

### Finding 1: [Title]
**Evidence:**
**Implications:**
**Confidence Level:**

### Finding 2: [Title]
**Evidence:**
**Implications:**
**Confidence Level:**

### Finding 3: [Title]
**Evidence:**
**Implications:**
**Confidence Level:**

## Data & Statistics
[Relevant numbers, trends, comparisons]

## Expert Perspectives
[Synthesize industry expert views]

## Case Studies
[Relevant examples or precedents]

## Implications for TaxDrop
- Product implications
- Marketing implications
- Competitive implications
- Timing considerations

## Recommendations
1. Immediate actions
2. Short-term strategies
3. Long-term considerations

## Areas for Further Research
[What we still don't know]

## Sources & References
[List of sources used]

---

**Specific Questions to Answer:**
{{QUESTIONS}}`,
    variables: [
      { key: 'TOPIC', label: 'Research Topic', placeholder: 'Impact of rising interest rates on property assessments', type: 'text' },
      { key: 'PURPOSE', label: 'Research Purpose', placeholder: 'Content marketing strategy', type: 'select', options: ['Content marketing strategy', 'Product development', 'Market positioning', 'Investor communication', 'Customer education', 'Policy response'] },
      { key: 'AUDIENCE', label: 'Target Audience', placeholder: 'Marketing team for content planning', type: 'text' },
      { key: 'DEPTH', label: 'Depth Required', placeholder: 'Comprehensive', type: 'select', options: ['Quick overview (1-2 pages)', 'Standard brief (3-5 pages)', 'Comprehensive (5-10 pages)', 'Deep dive (10+ pages)'] },
      { key: 'QUESTIONS', label: 'Specific Questions to Answer', placeholder: '1. How do rising rates affect home values?\n2. How quickly do assessments follow market changes?\n3. Which counties are most aggressive?', type: 'textarea' },
    ],
  },
];

const CATEGORIES = [...new Set(PROMPTS.map(p => p.category))];

export function PromptLibrary() {
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // AI Generation state
  const [selectedModel, setSelectedModel] = useState<TextModel>('anthropic/claude-sonnet-4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Integration state
  const [showOnlySocialModal, setShowOnlySocialModal] = useState(false);
  const [onlySocialAccounts, setOnlySocialAccounts] = useState<OnlySocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [isPostingToOnlySocial, setIsPostingToOnlySocial] = useState(false);
  const [onlySocialSuccess, setOnlySocialSuccess] = useState(false);

  const [showSendFoxModal, setShowSendFoxModal] = useState(false);
  const [sendFoxLists, setSendFoxLists] = useState<SendFoxList[]>([]);
  const [isLoadingSendFoxLists, setIsLoadingSendFoxLists] = useState(false);

  // Load OnlySocial accounts when modal opens
  useEffect(() => {
    if (showOnlySocialModal && hasOnlySocialConfig()) {
      listOnlySocialAccounts()
        .then(setOnlySocialAccounts)
        .catch(err => {
          console.error('Failed to load OnlySocial accounts:', err);
          setError('Failed to load OnlySocial accounts');
        });
    }
  }, [showOnlySocialModal]);

  // Load SendFox lists when modal opens
  useEffect(() => {
    if (showSendFoxModal && hasSendFoxApiKey()) {
      setIsLoadingSendFoxLists(true);
      getSendFoxLists()
        .then(setSendFoxLists)
        .catch(err => {
          console.error('Failed to load SendFox lists:', err);
          setError('Failed to load SendFox lists');
        })
        .finally(() => setIsLoadingSendFoxLists(false));
    }
  }, [showSendFoxModal]);

  const filteredPrompts = PROMPTS.filter(prompt => {
    const matchesSearch = searchTerm === '' ||
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    const initialVars: Record<string, string> = {};
    prompt.variables.forEach(v => {
      initialVars[v.key] = '';
    });
    setVariables(initialVars);
    setCopied(false);
    setGeneratedContent(null);
    setError(null);
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const generatePrompt = () => {
    if (!selectedPrompt) return '';
    let result = selectedPrompt.template;
    Object.entries(variables).forEach(([key, value]) => {
      const replacement = value || `[${key}]`;
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
    });
    return result;
  };

  const handleCopy = async () => {
    const textToCopy = generatedContent || generatePrompt();
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunWithClaude = async () => {
    if (!hasApiKey()) {
      setError('OpenRouter API key not configured. Go to Settings to add your key.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const prompt = generatePrompt();
      const result = await generateText({
        model: selectedModel,
        prompt,
        systemPrompt: 'You are a marketing content expert for TaxDrop, a property tax protest/appeal service. Create high-quality, engaging content that follows brand guidelines: conversational tone, helpful and confident, never salesy. Use "protest" for Texas and "appeal" for California.',
      });
      setGeneratedContent(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const filledCount = Object.values(variables).filter(v => v.trim() !== '').length;
  const totalCount = selectedPrompt?.variables.length || 0;

  // OnlySocial posting handler
  const handlePostToOnlySocial = async () => {
    if (selectedAccounts.length === 0) {
      setError('Please select at least one account');
      return;
    }

    if (!generatedContent) {
      setError('No content to post');
      return;
    }

    setIsPostingToOnlySocial(true);
    setError(null);

    try {
      await createOnlySocialPost(selectedAccounts, generatedContent);
      setOnlySocialSuccess(true);
      setTimeout(() => {
        setShowOnlySocialModal(false);
        setOnlySocialSuccess(false);
        setSelectedAccounts([]);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post to OnlySocial');
    } finally {
      setIsPostingToOnlySocial(false);
    }
  };

  const toggleAccountSelection = (accountId: number) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  return (
    <div>
      {!selectedPrompt ? (
        // Prompt Library List View
        <>
          <div className="card mb-lg">
            <div className="card-header">
              <h4>Prompt Library</h4>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray mb-md">
                Pre-built prompts for Claude optimized for TaxDrop content marketing. Select a prompt, fill in the variables, and run with Claude or copy to clipboard.
              </p>

              {/* Search and Filter */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search prompts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  className="form-select"
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  style={{ width: '200px' }}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${selectedCategory === null ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedCategory(null)}
                >
                  All ({PROMPTS.length})
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat} ({PROMPTS.filter(p => p.category === cat).length})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prompt Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredPrompts.map(prompt => (
              <div
                key={prompt.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => handleSelectPrompt(prompt)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{prompt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '16px' }}>{prompt.title}</h4>
                      <p className="text-xs text-gray" style={{ margin: '4px 0 8px' }}>
                        {prompt.category}
                      </p>
                      <p className="text-sm" style={{ margin: 0, color: '#5C666F' }}>
                        {prompt.description}
                      </p>
                      <p className="text-xs text-gray" style={{ marginTop: '8px' }}>
                        {prompt.variables.length} variable{prompt.variables.length !== 1 ? 's' : ''} to fill
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredPrompts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5C666F' }}>
              No prompts found matching your search.
            </div>
          )}
        </>
      ) : (
        // Prompt Detail/Fill View
        <>
          <div className="card mb-lg">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelectedPrompt(null);
                    setGeneratedContent(null);
                    setError(null);
                  }}
                >
                  ← Back
                </button>
                <span style={{ fontSize: '24px' }}>{selectedPrompt.icon}</span>
                <div>
                  <h4 style={{ margin: 0 }}>{selectedPrompt.title}</h4>
                  <p className="text-xs text-gray" style={{ margin: 0 }}>{selectedPrompt.category}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-sm text-gray">
                  {filledCount}/{totalCount} filled
                </span>
              </div>
            </div>
            <div className="card-body">
              <p className="text-gray mb-lg">{selectedPrompt.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Variables Form */}
                <div>
                  <h5 style={{ marginBottom: '16px', fontWeight: '600' }}>Fill Variables</h5>
                  {selectedPrompt.variables.map(variable => (
                    <div key={variable.key} className="form-group">
                      <label className="form-label">{variable.label}</label>
                      {variable.type === 'textarea' ? (
                        <textarea
                          className="form-input"
                          value={variables[variable.key] || ''}
                          onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                          placeholder={variable.placeholder}
                          rows={4}
                          style={{ resize: 'vertical' }}
                        />
                      ) : variable.type === 'select' ? (
                        <select
                          className="form-select"
                          value={variables[variable.key] || ''}
                          onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                        >
                          <option value="">Select {variable.label}...</option>
                          {variable.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          value={variables[variable.key] || ''}
                          onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                          placeholder={variable.placeholder}
                        />
                      )}
                    </div>
                  ))}

                  {/* AI Model Selection & Actions */}
                  <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <h5 style={{ marginBottom: '12px', fontWeight: '600' }}>Run with AI</h5>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Model</label>
                      <select
                        className="form-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as TextModel)}
                      >
                        {TEXT_MODELS.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {error && (
                      <div style={{
                        padding: '12px',
                        background: '#FEE2E2',
                        borderRadius: '6px',
                        color: '#DC2626',
                        fontSize: '13px',
                        marginBottom: '12px'
                      }}>
                        {error}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleRunWithClaude}
                        disabled={isGenerating}
                        style={{ flex: 1 }}
                      >
                        {isGenerating ? 'Generating...' : '✨ Run with Claude'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleCopy}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {!hasApiKey() && (
                      <p className="text-xs text-gray" style={{ marginTop: '8px' }}>
                        Configure your OpenRouter API key in Settings to run prompts with Claude.
                      </p>
                    )}
                  </div>
                </div>

                {/* Preview / Output */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h5 style={{ fontWeight: '600', margin: 0 }}>
                      {generatedContent ? 'Generated Output' : 'Prompt Preview'}
                    </h5>
                    {generatedContent && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setGeneratedContent(null)}
                      >
                        Show Prompt
                      </button>
                    )}
                  </div>

                  <div style={{
                    background: generatedContent ? '#FFFFFF' : '#1A1A1A',
                    color: generatedContent ? '#1A1A1A' : '#E5E7EB',
                    padding: '16px',
                    borderRadius: '8px',
                    fontFamily: generatedContent ? 'inherit' : 'monospace',
                    fontSize: generatedContent ? '14px' : '12px',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '600px',
                    overflow: 'auto',
                    lineHeight: 1.6,
                    border: generatedContent ? '1px solid #E5E7EB' : 'none',
                  }}>
                    {generatedContent || generatePrompt()}
                  </div>

                  {/* Post-generation actions */}
                  {generatedContent && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: 'var(--td-mint)',
                      borderRadius: '8px',
                    }}>
                      <p className="text-sm" style={{ marginBottom: '12px', fontWeight: '500' }}>
                        What would you like to do with this content?
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleCopy}
                        >
                          {copied ? 'Copied!' : 'Copy to Clipboard'}
                        </button>
                        {selectedPrompt.outputType === 'blog' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => alert('Copy the content and paste it into the Blog Posts section, then publish to Webflow.')}
                          >
                            → Blog Posts Editor
                          </button>
                        )}
                        {selectedPrompt.outputType === 'social' && (
                          <>
                            {hasOnlySocialConfig() ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowOnlySocialModal(true)}
                              >
                                📤 Post to OnlySocial
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => alert('Configure OnlySocial in Settings to post directly.')}
                              >
                                📤 Post to OnlySocial
                              </button>
                            )}
                          </>
                        )}
                        {selectedPrompt.outputType === 'email' && (
                          <>
                            {hasSendFoxApiKey() ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowSendFoxModal(true)}
                              >
                                ✉️ View SendFox Lists
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => alert('Configure SendFox API key in Settings to integrate.')}
                              >
                                ✉️ SendFox
                              </button>
                            )}
                          </>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={handleRunWithClaude}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* OnlySocial Modal */}
      {showOnlySocialModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Post to OnlySocial</h4>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowOnlySocialModal(false);
                  setSelectedAccounts([]);
                  setOnlySocialSuccess(false);
                }}
              >
                ✕
              </button>
            </div>

            {onlySocialSuccess ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--td-emerald-light)',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
                <p style={{ fontWeight: '500' }}>Posted successfully!</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray mb-md">
                  Select accounts to post your content to:
                </p>

                {onlySocialAccounts.length === 0 ? (
                  <p className="text-sm text-gray">Loading accounts...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {onlySocialAccounts.map(account => (
                      <label
                        key={account.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: selectedAccounts.includes(account.id) ? 'var(--td-mint)' : 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(account.id)}
                          onChange={() => toggleAccountSelection(account.id)}
                        />
                        {account.image && (
                          <img
                            src={account.image}
                            alt={account.name}
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                          />
                        )}
                        <div>
                          <p style={{ margin: 0, fontWeight: '500' }}>{account.name}</p>
                          <p className="text-xs text-gray" style={{ margin: 0 }}>
                            {account.provider} • @{account.username}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div style={{
                  background: '#F9FAFB',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  maxHeight: '150px',
                  overflow: 'auto',
                }}>
                  <p className="text-xs text-gray" style={{ margin: '0 0 8px', fontWeight: '500' }}>Preview:</p>
                  <p className="text-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {generatedContent?.slice(0, 500)}{generatedContent && generatedContent.length > 500 ? '...' : ''}
                  </p>
                </div>

                {error && (
                  <div style={{
                    padding: '12px',
                    background: '#FEE2E2',
                    borderRadius: '6px',
                    color: '#DC2626',
                    fontSize: '13px',
                    marginBottom: '12px'
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowOnlySocialModal(false);
                      setSelectedAccounts([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handlePostToOnlySocial}
                    disabled={isPostingToOnlySocial || selectedAccounts.length === 0}
                  >
                    {isPostingToOnlySocial ? 'Posting...' : `Post to ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SendFox Modal */}
      {showSendFoxModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>SendFox Email Lists</h4>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSendFoxModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray mb-md">
              Copy your email content, then create a campaign in SendFox and paste it there.
              SendFox's API doesn't support creating campaigns directly.
            </p>

            <div style={{
              background: '#F9FAFB',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              maxHeight: '200px',
              overflow: 'auto',
            }}>
              <p className="text-xs text-gray" style={{ margin: '0 0 8px', fontWeight: '500' }}>Your Email Content:</p>
              <p className="text-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {generatedContent?.slice(0, 800)}{generatedContent && generatedContent.length > 800 ? '...' : ''}
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (generatedContent) {
                  navigator.clipboard.writeText(generatedContent);
                  alert('Content copied! Now open SendFox to create your campaign.');
                }
              }}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              Copy Content
            </button>

            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
              <p className="text-sm" style={{ fontWeight: '500', marginBottom: '8px' }}>Your SendFox Lists:</p>
              {isLoadingSendFoxLists ? (
                <p className="text-sm text-gray">Loading lists...</p>
              ) : sendFoxLists.length === 0 ? (
                <p className="text-sm text-gray">No lists found. Create one in SendFox.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sendFoxLists.map(list => (
                    <div
                      key={list.id}
                      style={{
                        padding: '12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: '500' }}>{list.name}</span>
                      {list.subscribers_count !== undefined && (
                        <span className="text-sm text-gray">
                          {list.subscribers_count} subscriber{list.subscribers_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowSendFoxModal(false)}
              >
                Close
              </button>
              <a
                href="https://sendfox.com/emails"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Open SendFox →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

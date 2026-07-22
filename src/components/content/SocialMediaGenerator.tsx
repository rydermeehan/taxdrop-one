import { useState, useEffect, useRef } from 'react';
import type { Brand, TrendIdeaTransfer } from '../../types';
import {
  generateImage,
  generateText,
  hasApiKey,
  getOpenRouterSettings,
  IMAGE_MODELS,
  TEXT_MODELS,
  type ImageModel,
  type TextModel,
  type GeneratedImage,
} from '../../services/openrouterService';
import {
  hasOnlySocialConfig,
  listAccounts,
  createPost,
  uploadMedia,
  type OnlySocialAccount,
} from '../../services/onlySocialService';
import {
  saveImage,
  getAllImages,
  deleteImage,
  clearAllImages,
  getStorageStats,
  migrateFromLocalStorage,
} from '../../services/imageStorage';
import {
  SOCIAL_POST_SYSTEM_PROMPT,
  POST_FORMATS,
  PLATFORM_INFO,
  buildUserPrompt,
  buildPromotePrompt,
  fetchPageContent,
  autoSelectSceneId,
  buildAutoImagePrompt,
  parseDraftResponse,
  type SocialPlatformKey,
  type PostFormat,
  type GeneratedDraft,
  type PageContent,
} from '../../services/socialPostService';
import {
  hasN8nWebhookUrl,
  publishViaN8n,
  type PublishResult,
} from '../../services/n8nPublishService';
import { CopyIcon, CheckIcon, ImageIcon, DownloadIcon } from '../common/Icons';

// Extended image type with IndexedDB id
interface StoredGeneratedImage {
  id: string;
  url: string;
  prompt?: string;
  model?: string;
  timestamp?: string;
  platform: string;
  scene: string;
}

interface SocialMediaGeneratorProps {
  brands?: Brand[];
  initialIdea?: TrendIdeaTransfer;
  onIdeaConsumed?: () => void;
  queueRemaining?: number;
}

// Social media platform formats
const PLATFORMS = [
  {
    id: 'instagram-square',
    label: 'Instagram Post',
    platform: 'Instagram',
    dimensions: '1080x1080',
    aspectRatio: '1:1' as const,
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story',
    platform: 'Instagram',
    dimensions: '1080x1920',
    aspectRatio: '9:16' as const,
  },
  {
    id: 'facebook-post',
    label: 'Facebook Post',
    platform: 'Facebook',
    dimensions: '1200x630',
    aspectRatio: '1.91:1' as const,
  },
  {
    id: 'linkedin-post',
    label: 'LinkedIn Post',
    platform: 'LinkedIn',
    dimensions: '1200x627',
    aspectRatio: '1.91:1' as const,
  },
  {
    id: 'twitter-post',
    label: 'X/Twitter Post',
    platform: 'X/Twitter',
    dimensions: '1600x900',
    aspectRatio: '16:9' as const,
  },
];

// Brand Signature Style - consistent across all images
// IMPORTANT: Never mention brand names in image prompts — AI generators will render them as visible text/logos
const TAXDROP_BRAND_STYLE = `
CAMERA: Shot on Sony A7R IV with 35mm f/1.4 lens, shallow depth of field f/2.0, eye-level or slightly below angle.
LIGHTING: Bright and airy, soft natural window light or golden hour outdoors, high-key exposure, minimal harsh shadows, clean and optimistic feeling.
COLOR PALETTE: Emerald green (#0B8F52) in clothing, plants, doors, or decor; soft mint (#DFFFEA) in walls or soft backgrounds; occasional yellow-green (#C4FF64) pop in small accents; sky blue (#C6F0FF) in sky or subtle details; clean whites and warm wood tones.
COLOR GRADING: Warm and inviting, lifted shadows, slightly desaturated blacks, warm skin tones, fresh green tones enhanced, overall bright and hopeful feel.
SUBJECTS: Authentic diverse American homeowners aged 30-55, genuine expressions, relatable and aspirational, professional but approachable styling. Plain unbranded clothing only.
COMPOSITION: Clean uncluttered frames, strong single subject focus, rule of thirds, environmental context showing home/neighborhood, negative space for potential text overlay.
MOOD: Optimistic, relieved, empowered, trustworthy - the feeling of a weight being lifted or taking control.
CONSISTENCY: Every image should feel like part of the same photo series - same lighting quality, same color temperature, same level of polish.
CRITICAL: Absolutely no logos, brand names, text, watermarks, writing on clothing, signs with words, or any visible branding of any kind. All clothing must be plain and unbranded. All surfaces must be free of text. The image must look like authentic editorial photography, not an advertisement.
`.trim().replace(/\n/g, ' ');

// Style presets for social images
const STYLE_PRESETS = [
  {
    id: 'taxdrop-brand',
    label: 'Brand Style',
    description: 'Brand colors, lighting & composition',
    suffix: TAXDROP_BRAND_STYLE
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic Premium',
    description: 'Real people in authentic scenarios',
    suffix: 'ultra photorealistic, shot on Sony A7R IV with 24-70mm f/2.8 GM lens, natural lighting with soft diffusion, shallow depth of field f/2.8, color graded with warm highlights and cool shadows, magazine cover quality, Getty Images premium stock style, authentic and relatable, no artificial or CGI elements, real-world setting, professional commercial photography, diverse authentic people'
  },
  {
    id: 'lifestyle-authentic',
    label: 'Lifestyle Authentic',
    description: 'Candid natural moments',
    suffix: 'authentic lifestyle photography, candid natural moments, real people in real situations, documentary style but polished, warm inviting tones, shallow depth of field, environmental context, storytelling composition, relatable and aspirational, Instagram-worthy quality'
  },
  {
    id: 'bright-airy',
    label: 'Bright & Airy',
    description: 'High-key with soft shadows',
    suffix: 'bright airy photography, high-key exposure, minimal shadows, clean and fresh feel, window light aesthetic, lifestyle photography, soft warm tones, professional quality'
  },
];

// Scene templates for social content - photorealistic lifestyle scenes
const SCENE_TEMPLATES = [
  // Homeowner moments
  {
    id: 'front-porch-pride',
    label: 'Front Porch Pride',
    concept: 'Confident homeowner on porch',
    keywords: 'single homeowner standing relaxed on front porch of suburban home, arms crossed confidently or leaning on railing, genuine warm smile, emerald green plants or green front door visible, bright airy natural light'
  },
  {
    id: 'kitchen-relief',
    label: 'Kitchen Table Moment',
    concept: 'Relief reviewing paperwork',
    keywords: 'homeowner at bright kitchen table with paperwork, expression of relief and satisfaction, mint green or white kitchen background, natural window light streaming in, coffee mug nearby, clean modern interior'
  },
  {
    id: 'mailbox-good-news',
    label: 'Good News at Mailbox',
    concept: 'Positive news arrives',
    keywords: 'person at mailbox holding opened letter with pleasantly surprised smile, suburban street background, bright daylight, green landscaping visible, relatable everyday moment'
  },
  {
    id: 'living-room-laptop',
    label: 'Cozy Research Time',
    concept: 'Researching comfortably',
    keywords: 'person on couch with laptop in bright living room, houseplants adding green accents, engaged interested expression, large window with natural light, clean modern decor with white and mint tones'
  },
  {
    id: 'phone-celebration',
    label: 'Great News Call',
    concept: 'Celebrating on phone',
    keywords: 'person on phone with delighted expression, standing in bright home interior with plants, natural happy gesture, clean background with green accent plant or decor'
  },
  {
    id: 'couple-front-yard',
    label: 'Couple in Front Yard',
    concept: 'Happy couple with home',
    keywords: 'couple standing together in front yard, one wearing emerald green shirt, genuine happy expressions, well-maintained lawn, bright sunny day, suburban home in background'
  },
  {
    id: 'aha-moment',
    label: 'Aha Moment',
    concept: 'Surprising discovery',
    keywords: 'person looking at laptop screen or documents with pleasantly surprised expression, eyes widened slightly, hand gesture of realization, bright clean background, lightbulb moment feeling, discovering unexpected good news'
  },
  {
    id: 'coffee-morning',
    label: 'Morning Coffee',
    concept: 'Peaceful morning routine',
    keywords: 'person enjoying coffee on front porch or in bright kitchen, relaxed peaceful expression, morning light streaming in, houseplants visible, cozy comfortable feeling, starting the day right'
  },
  // Location-specific
  {
    id: 'texas-home',
    label: 'Texas Home',
    concept: 'Texas setting',
    keywords: 'homeowner in front of Texas suburban home, modern architecture, warm golden light, blue sky, confident relaxed pose, green lawn, Texas neighborhood feel'
  },
  {
    id: 'california-home',
    label: 'California Home',
    concept: 'California setting',
    keywords: 'homeowner in front of California craftsman home, palm or succulent plants visible, bright sunshine, relaxed confident expression, well-landscaped with green plants'
  },
  // Educational/informational
  {
    id: 'document-discovery',
    label: 'Document Discovery',
    concept: 'Examining important paperwork',
    keywords: 'person at bright home office desk examining official documents with focused curious expression, reading glasses nearby, natural window light, organized papers spread out, discovering important information, professional but relatable'
  },
  {
    id: 'expert-desk',
    label: 'Expert at Work',
    concept: 'Professional authority',
    keywords: 'professional person at organized modern desk with laptop and neatly arranged folders, confident knowledgeable expression, emerald green plant on desk, bright natural light, authoritative but approachable, comprehensive guide feeling'
  },
  {
    id: 'calculator-review',
    label: 'Number Crunching',
    concept: 'Financial analysis',
    keywords: 'person reviewing numbers with calculator and documents on bright desk, thoughtful concentrated expression, neat organized workspace, natural light, making sense of financial data, emerald green accent item visible'
  },
  // Success/celebration
  {
    id: 'thumbs-up-success',
    label: 'Success Thumbs Up',
    concept: 'Celebration gesture',
    keywords: 'homeowner giving enthusiastic thumbs up in front of home, big genuine smile, casual clothing with green accents, bright sunny day, celebratory confident energy, relatable victory moment'
  },
  {
    id: 'backyard-relaxed',
    label: 'Backyard Ease',
    concept: 'Relaxed enjoying property',
    keywords: 'homeowner relaxed in backyard patio area, stress-free content expression, green lawn and plants surrounding, bright airy outdoor light, enjoying their home'
  },
  // Conceptual/scenic
  {
    id: 'neighborhood-aerial',
    label: 'Neighborhood Aerial',
    concept: 'Birds-eye view of community',
    keywords: 'stunning aerial drone photograph of suburban neighborhood at golden hour, tree-lined streets, well-maintained homes, sense of community and value, warm natural lighting'
  },
  {
    id: 'home-exterior-detail',
    label: 'Architectural Detail',
    concept: 'Focus on home craftsmanship',
    keywords: 'close-up architectural detail of beautiful home exterior, front door with character, quality craftmanship, warm inviting light, shallow depth of field, editorial real estate photography'
  },
  {
    id: 'front-yard-morning',
    label: 'Morning Curb Appeal',
    concept: 'Home at its best',
    keywords: 'pristine home exterior in soft morning light, manicured lawn with dew, fresh and optimistic feeling, real estate photography style, no people'
  },
  // Challenging/Negative situations - for blogs about tax increases, policy impacts, etc.
  {
    id: 'tax-increase-shock',
    label: 'Tax Increase Shock',
    concept: 'Worried about unexpected bill',
    keywords: 'homeowner at home office desk looking at property tax bill with concerned worried expression, papers spread out, hand on forehead or rubbing temple, modern home office with window light, realistic worried but not devastated emotion, relatable financial stress moment'
  },
  {
    id: 'government-policy',
    label: 'Government/Policy Impact',
    concept: 'Policy and legislation effects',
    keywords: 'state capitol building dome with official documents in foreground, news headline newspaper or screen showing policy update, professional photojournalism style, slightly dramatic lighting, sense of important decisions being made, no specific political imagery'
  },
  {
    id: 'financial-stress',
    label: 'Financial Stress',
    concept: 'Managing money pressure',
    keywords: 'person at kitchen table reviewing multiple bills and documents, calculator nearby, slightly stressed but determined expression, natural home lighting, realistic middle-class home setting, stack of mail and papers, hopeful undertone despite stress'
  },
  {
    id: 'unfair-assessment',
    label: 'Unfair Assessment',
    concept: 'Inequality in valuations',
    keywords: 'conceptual split image showing two similar homes side by side with unequal balance scale overlay, visual metaphor for unfair property assessment, one home appearing overvalued, editorial illustration style, clean modern homes'
  },
  {
    id: 'deadline-pressure',
    label: 'Deadline Pressure',
    concept: 'Time-sensitive action needed',
    keywords: 'calendar on wall with deadline date circled in red, clock showing time passing, sense of urgency but manageable, home office or kitchen setting, warm but alert mood, to-do list or official envelope visible, motivating not panic-inducing'
  },
  {
    id: 'economic-uncertainty',
    label: 'Economic Uncertainty',
    concept: 'Market volatility concerns',
    keywords: 'person watching financial news on TV or laptop, stock market charts trending upward, newspaper with economic headlines, thoughtful concerned expression, living room setting, sense of uncertainty about future, news ticker visual, real estate market imagery'
  },
  {
    id: 'appeal-denied',
    label: 'Appeal Denied',
    concept: 'Setback but not defeat',
    keywords: 'person reading official letter with disappointed but determined expression, denial notice or rejection letter, sitting at desk with documents, natural light, resilient mood suggesting next steps, not giving up'
  },
  {
    id: 'property-value-drop',
    label: 'Property Value Concerns',
    concept: 'Declining home values',
    keywords: 'homeowner looking at for-sale signs in neighborhood, concerned thoughtful expression, suburban street with multiple homes, sense of market downturn, golden hour light, contemplating property values, realistic neighborhood scene'
  },
];

// Caption templates for social posts (4:1 value-to-ask ratio)
const CAPTION_TEMPLATES = {
  // VALUE CAPTIONS
  'tip': `💡 Property Tax Tip:

{tip}

Save this for later! 📌

#PropertyTaxTips #HomeownerTips #SaveMoney`,

  'did-you-know': `🤔 Did you know?

{fact}

Most homeowners don't realize this — and it costs them.

#DidYouKnow #PropertyTax #HomeownerFacts`,

  'myth-buster': `🚫 MYTH: "{myth}"

✅ TRUTH: {truth}

Don't let misinformation cost you money.

#PropertyTaxMyths #FactCheck #HomeownerTips`,

  'how-to': `📋 How to {goal}:

Step 1: {step1}
Step 2: {step2}
Step 3: {step3}

Save this for when you need it! 📌

#HowTo #PropertyTax #StepByStep`,

  // ASK CAPTIONS
  'success-story': `🎉 Real results:

"{quote}" — {name}, {location}

They saved {savings} on their property taxes.

Your turn? → TaxDrop.com

#Success #PropertyTax #TaxDrop`,

  'cta': `🏡 Paying too much in property taxes?

You're not alone. 30-60% of properties are over-assessed.

TaxDrop helps homeowners fight back and WIN.
✅ Free savings estimate
✅ Expert-driven appeals
✅ No savings, no fee

Start free → TaxDrop.com

#PropertyTax #SaveMoney #TaxDrop`,
};

// TypeShare-style post templates for LinkedIn/Twitter
interface PostTemplate {
  id: string;
  label: string;
  platform: 'linkedin' | 'twitter' | 'both';
  description: string;
  template: string;
}

const POST_TEMPLATES: PostTemplate[] = [
  // LinkedIn-style long-form posts
  {
    id: 'future-of-industry',
    label: 'The Future Of [Industry]',
    platform: 'linkedin',
    description: 'Bold prediction with data points',
    template: `The future of [property taxes] is [homeowner empowerment]. Here's why in 250 words.

We're at a turning point in [property tax appeals].

The future is [homeowners taking control of their assessments].

[Most people don't realize they're overpaying. Assessment errors are shockingly common — and fighting back is easier than you think].

But if you're in any doubt, here are 3 data points to back it up:

Data Point #1: [30-60% of properties are over-assessed]
This matters for 3 reasons:
• [Assessors use mass appraisal — they miss property-specific issues]
• [Errors compound year after year]
• [The burden is on YOU to catch them]

This perfectly illustrates the future of [property tax advocacy].

Data Point #2: [Only 5% of homeowners appeal their assessment]
When you think about [the success rate of 80-90%], this is mind-blowing.
• [Most people assume the assessment is correct]
• [They don't know the process]
• [They think it's too complicated]

It's an exciting time to be in [property tax tech].

Data Point #3: [Average savings are 10-15% annually]
Most people don't know this, and so they make these mistakes:
• [Waiting until it's too late (May 15 deadline in TX)]
• [Not gathering proper evidence]
• [Giving up after one try]

Don't be like everyone else!

#PropertyTax #Homeowners #TaxSavings`
  },
  {
    id: 'unpopular-opinion',
    label: 'Unpopular Opinion',
    platform: 'both',
    description: 'Contrarian take that sparks discussion',
    template: `Unpopular opinion: [Paying your full property tax bill is optional — if you know the system].

Here's why most people get this wrong:

They think [the assessment is final].
They believe [fighting it is too hard].
They assume [only the wealthy can afford to appeal].

But the truth is:
• [Anyone can file a protest]
• [The success rate is 80-90%]
• [Services like TaxDrop handle it for you — no upfront cost]

The real question isn't whether to appeal.

It's why you haven't already.

What's your take? 👇

#PropertyTax #UnpopularOpinion #HomeownerTips`
  },
  {
    id: 'i-spent-x-hours',
    label: 'I Spent [X] Hours',
    platform: 'linkedin',
    description: 'Research-based insight sharing',
    template: `I spent [100+ hours] studying [property tax appeals].

Here's what I learned (so you don't have to):

𝟭. [Your assessment is probably wrong]
[Assessors use automated valuations. They miss renovations, damage, and market shifts. Errors are the rule, not the exception.]

𝟮. [The deadline is everything]
[In Texas: May 15. Miss it and you're locked in for another year. Mark your calendar NOW.]

𝟯. [Evidence wins cases]
[Comparable sales within 6 months and 1 mile. Condition photos. Recent appraisals. Stack your case high.]

𝟰. [You don't have to do it yourself]
[Contingency services mean no risk. You only pay if they save you money.]

𝟱. [It's not confrontational]
[Most cases settle in informal hearings. It's a conversation, not a courtroom.]

The bottom line?

[Most homeowners are leaving $500-2,000+ on the table every single year.]

Save this post. Share with a homeowner friend.

#PropertyTaxTips #Homeowners #TaxSavings`
  },
  {
    id: 'stop-doing-this',
    label: 'Stop Doing [This]',
    platform: 'both',
    description: 'Call out common mistakes',
    template: `Stop [paying your property taxes without questioning them].

Here's why:

❌ [You're trusting a system designed to maximize revenue]
❌ [Errors are incredibly common]
❌ [The longer you wait, the more you overpay]

What to do instead:

✅ [Check your property details for errors]
✅ [Compare to similar homes that sold recently]
✅ [File before the deadline — even if you're unsure]

The worst case? [Nothing changes.]
The best case? [Hundreds or thousands saved annually.]

Which would you rather have?

#PropertyTax #MoneyMistakes #HomeownerAdvice`
  },
  {
    id: 'the-x-framework',
    label: 'The [X] Framework',
    platform: 'linkedin',
    description: 'Systematic approach to a problem',
    template: `The [3-Step Property Tax Protest] Framework:

Most homeowners overcomplicate this.

Here's the simple system that works:

𝐒𝐭𝐞𝐩 𝟏: [CHECK]
→ Review your assessment notice
→ Verify property details (sq ft, beds, baths)
→ Compare to neighborhood sales

𝐒𝐭𝐞𝐩 𝟐: [GATHER]
→ Recent comparable sales (6 months, 1 mile)
→ Photos of any condition issues
→ Recent appraisal if available

𝐒𝐭𝐞𝐩 𝟑: [FILE]
→ Submit before the deadline
→ Present evidence at informal hearing
→ Escalate to ARB if needed

That's it. No lawyers required. No complicated forms.

Just evidence + timing.

Save this framework. Use it every year.

#PropertyTax #Framework #HomeownerGuide`
  },
  {
    id: 'what-nobody-tells-you',
    label: 'What Nobody Tells You',
    platform: 'both',
    description: 'Insider knowledge reveal',
    template: `What nobody tells you about [property tax assessments]:

1. [They WANT you to overpay]
Government revenue depends on it. They're not going to call you and say "hey, you're paying too much."

2. [The burden is on YOU]
No one is looking out for your wallet except you. If you don't check, no one will.

3. [It's designed to be confusing]
Appraisal districts, ARB hearings, protest deadlines... they don't make it easy on purpose.

4. [Most people never try]
Only 5% of homeowners file protests. That's not because it's hard — it's because no one tells them they can.

5. [The success rate is insane]
80-90% of protests get a reduction. Read that again.

Now you know.

What will you do with this information?

#PropertyTax #Secrets #HomeownerTips`
  },
  {
    id: 'x-years-ago-vs-now',
    label: '[X] Years Ago vs. Now',
    platform: 'linkedin',
    description: 'Then vs now comparison',
    template: `5 years ago: [I paid whatever the tax bill said]

Today: [I protest every year and save thousands]

What changed?

I learned that:

→ [Assessments are opinions, not facts]
→ [Evidence beats assumptions]
→ [The process takes less time than I thought]
→ [Services exist that handle it with zero upfront cost]

The old me thought: "The government knows what my house is worth."

The new me knows: [They're guessing. And I can challenge that guess.]

Your turn.

#PropertyTax #Growth #MoneyMindset`
  },
  {
    id: 'controversial-take',
    label: 'Controversial Take',
    platform: 'both',
    description: 'Bold statement to spark engagement',
    template: `Controversial take:

[Not protesting your property taxes is throwing money away.]

And I'll defend this position.

Here's why:

• [80-90% of protests result in some reduction]
• [Average savings are 10-15% annually]
• [Most homeowners qualify but never try]

"But it's too complicated."
[→ You can hire someone on contingency — no savings, no fee]

"But I don't have time."
[→ It takes less than 30 minutes to file]

"But my house is actually worth that much."
[→ Fair market value isn't assessed value. They're different things.]

The only people who shouldn't protest?

[People who like paying more than they have to.]

Agree or disagree? 👇

#PropertyTax #HotTake #HomeownerAdvice`
  },
  {
    id: 'x-mistakes',
    label: '[X] Mistakes That Cost',
    platform: 'linkedin',
    description: 'Common pitfalls to avoid',
    template: `7 property tax mistakes that cost homeowners thousands:

𝟏. [Assuming the assessment is correct]
It's not. 30-60% of properties are over-assessed.

𝟐. [Missing the deadline]
In Texas, it's May 15. No exceptions.

𝟑. [Not gathering evidence]
Comparable sales win cases. Opinions don't.

𝟒. [Only protesting once]
Markets change. Protest annually.

𝟓. [Ignoring exemptions]
Homestead, over-65, disability — check what you qualify for.

𝟔. [Being emotional at hearings]
Facts beat feelings. Every time.

𝟕. [Trying to do it alone]
Contingency services take the work off your plate — you only pay if they save you money.

Which one surprised you most?

#PropertyTax #Mistakes #HomeownerTips`
  },
  {
    id: 'if-you-want-to-x',
    label: 'If You Want to [X]',
    platform: 'both',
    description: 'Clear path to a goal',
    template: `If you want to [lower your property taxes]:

Don't: [Wait for someone else to find the error]
Do: [Check your assessment the moment it arrives]

Don't: [Assume you can't win]
Do: [Know that 80-90% of protests succeed]

Don't: [Go in without evidence]
Do: [Gather comparable sales and condition photos]

Don't: [Miss the deadline]
Do: [Mark May 15 in your calendar TODAY (TX)]

Don't: [Give up after a no]
Do: [Escalate to ARB if the informal hearing fails]

It's not luck. It's a system.

And you can start right now.

#PropertyTax #ActionPlan #Homeowners`
  },
  // Twitter/X thread starters
  {
    id: 'thread-myth-busting',
    label: 'Myth Busting Thread',
    platform: 'twitter',
    description: 'Thread correcting misconceptions',
    template: `Property tax myths that are costing you money 🧵

1/ "My assessment is set by experts who know my property"

FALSE. Assessors use mass appraisal. They've likely never seen your house.

2/ "If I protest, my taxes might go UP"

FALSE. Your assessment can't increase from a protest you filed. That's not how it works.

3/ "I need a lawyer to fight my assessment"

FALSE. Most cases are resolved in informal hearings. No lawyers required.

4/ "It's not worth the effort"

FALSE. Average savings are 10-15%. On a $400K home? That's $400-600/year.

5/ "The deadline already passed"

MAYBE TRUE. Check your state. TX = May 15. CA = varies by county.

Save this thread. Forward to a homeowner friend.

#PropertyTax #MythBusting`
  },
  {
    id: 'thread-how-i',
    label: 'How I [Did X] Thread',
    platform: 'twitter',
    description: 'Personal story thread',
    template: `How I saved $1,200/year on property taxes (step by step) 🧵

1/ It started when I actually READ my assessment notice.

The square footage was wrong. By 200 sq ft.

That "small" error was costing me hundreds every year.

2/ I gathered my evidence:

• Correct measurements
• 3 comparable sales from the last 6 months
• Photos of condition issues the assessor couldn't see

3/ I filed before the deadline.

In Texas, that's May 15. I marked it months in advance.

4/ The informal hearing took 15 minutes.

I showed my evidence. They agreed the value was too high.

5/ New assessment: $45,000 lower.
Annual savings: $1,200+.
Time invested: ~2 hours total.

6/ The truth?

Anyone can do this. You just need to know it's possible.

Now you do.

#PropertyTax #HowTo #Savings`
  },
];

// Comment templates for engagement
interface CommentTemplate {
  id: string;
  label: string;
  description: string;
  context: string;
  template: string;
}

const COMMENT_TEMPLATES: CommentTemplate[] = [
  {
    id: 'add-value',
    label: 'Add Value',
    description: 'Share helpful information without selling',
    context: 'Use when someone posts about property taxes, home buying, or real estate',
    template: `Great point! One thing many people don't realize: {insight}. This alone can make a big difference.`,
  },
  {
    id: 'share-stat',
    label: 'Share a Stat',
    description: 'Back up a point with data',
    context: 'Use when someone makes a claim you can support with facts',
    template: `This is so true. In fact, {stat}. More homeowners need to know this.`,
  },
  {
    id: 'ask-question',
    label: 'Ask a Question',
    description: 'Start a conversation and show genuine interest',
    context: 'Use to engage authentically with content creators',
    template: `Interesting perspective! Have you noticed {question}? I'd love to hear your take.`,
  },
  {
    id: 'offer-tip',
    label: 'Offer a Tip',
    description: 'Give actionable advice they can use immediately',
    context: 'Use when someone asks for help or seems stuck',
    template: `Quick tip that might help: {tip}. This works especially well for {situation}.`,
  },
  {
    id: 'clarify-myth',
    label: 'Clarify a Myth',
    description: 'Gently correct misinformation',
    context: 'Use when you see incorrect property tax info being shared',
    template: `Common misconception! Actually, {truth}. Easy to get confused on this one.`,
  },
  {
    id: 'show-support',
    label: 'Show Support',
    description: 'Encourage and validate their content',
    context: 'Use for real estate agents, financial advisors, or homeowner advocates',
    template: `Love that you're sharing this! {why_it_matters}. Keep it up!`,
  },
];

// Map Trend Monitor platform label → SocialPlatformKey[]
function mapTrendPlatforms(platform: string): SocialPlatformKey[] {
  const p = platform.toLowerCase();
  if (p.includes('instagram')) return ['instagram'];
  if (p.includes('linkedin')) return ['linkedin'];
  if (p.includes('twitter') || p.includes('/x')) return ['twitter'];
  if (p.includes('facebook')) return ['facebook'];
  return ['linkedin', 'twitter', 'instagram', 'facebook'];
}

// Map Trend Monitor format → PostFormat
function mapTrendFormat(format: string): PostFormat {
  switch (format) {
    case 'myth-bust': return 'myth-buster';
    case 'tip': return 'tips-list';
    case 'educational': return 'tips-list';
    case 'commentary': return 'unpopular-opinion';
    case 'guide': return 'tips-list';
    default: return 'freeform';
  }
}

// Map Trend Monitor topic → target state
function mapTrendState(topic: string): 'texas' | 'california' | 'general' {
  const t = topic.toLowerCase();
  if (t.includes('texas') || t.includes('tx')) return 'texas';
  if (t.includes('california') || t.includes('ca')) return 'california';
  return 'general';
}

export function SocialMediaGenerator({ brands = [], initialIdea, onIdeaConsumed, queueRemaining = 0 }: SocialMediaGeneratorProps) {
  void brands;

  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0]);
  const [scene, setScene] = useState(SCENE_TEMPLATES[0]);
  const [imageTheme, setImageTheme] = useState(''); // Primary subject/theme for the image
  const [customContext, setCustomContext] = useState('');
  const [captionType, setCaptionType] = useState<keyof typeof CAPTION_TEMPLATES>('tip');
  const [caption, setCaption] = useState(CAPTION_TEMPLATES['tip']);
  const [selectedModel, setSelectedModel] = useState<ImageModel>('google/gemini-3-pro-image-preview');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<StoredGeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<{ count: number; estimatedSize: string } | null>(null);

  // OnlySocial state
  const [socialAccounts, setSocialAccounts] = useState<OnlySocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Comment generator state
  const [commentTemplate, setCommentTemplate] = useState(COMMENT_TEMPLATES[0]);
  const [generatedComment, setGeneratedComment] = useState('');
  const [commentCopied, setCommentCopied] = useState(false);

  // Post template state
  const [postTemplate, setPostTemplate] = useState(POST_TEMPLATES[0]);
  const [generatedPost, setGeneratedPost] = useState(POST_TEMPLATES[0].template);
  const [postCopied, setPostCopied] = useState(false);
  const [postFilter, setPostFilter] = useState<'all' | 'linkedin' | 'twitter'>('all');

  // Create Post tab state
  type GeneratorTab = 'create' | 'templates';
  const [activeTab, setActiveTab] = useState<GeneratorTab>('create');
  const [postConcept, setPostConcept] = useState('');
  const [targetState, setTargetState] = useState<'texas' | 'california' | 'general'>('texas');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatformKey[]>(['linkedin', 'twitter']);
  const [postFormat, setPostFormat] = useState<PostFormat>('freeform');
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraft | null>(null);
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [draftImage, setDraftImage] = useState<GeneratedImage | null>(null);
  const [selectedTextModel, setSelectedTextModel] = useState<TextModel>('anthropic/claude-sonnet-4-5');
  const [activeDraftPlatform, setActiveDraftPlatform] = useState<SocialPlatformKey>('linkedin');
  const [editedDrafts, setEditedDrafts] = useState<Record<string, string>>({});
  const [draftCopied, setDraftCopied] = useState(false);

  // N8N Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Promote a Link state
  type CreateMode = 'concept' | 'promote';
  const [createMode, setCreateMode] = useState<CreateMode>('concept');
  const [promoteUrl, setPromoteUrl] = useState('');
  const [fetchingPage, setFetchingPage] = useState(false);
  const [fetchedPage, setFetchedPage] = useState<PageContent | null>(null);

  const onlySocialConfigured = hasOnlySocialConfig();

  // Banner to show when idea was pre-loaded from Trend Monitor
  const [ideaBanner, setIdeaBanner] = useState<string | null>(null);
  const ideaConsumedRef = useRef(false);

  // Pre-populate form when an idea is passed from Trend Monitor
  useEffect(() => {
    if (!initialIdea || ideaConsumedRef.current) return;
    ideaConsumedRef.current = true;

    // Build the concept string — hook + caption + hashtags
    const conceptText = [
      initialIdea.hook,
      '',
      initialIdea.caption,
      '',
      initialIdea.hashtags.join(' '),
    ].join('\n');

    setActiveTab('create');
    setCreateMode('concept');
    setPostConcept(conceptText);
    setSelectedPlatforms(mapTrendPlatforms(initialIdea.platform));
    setPostFormat(mapTrendFormat(initialIdea.format));
    setTargetState(mapTrendState(initialIdea.topic));

    if (initialIdea.imagePrompt) {
      setImageTheme(initialIdea.imagePrompt);
    }

    // Auto-select image scene based on format/audience
    const audience = initialIdea.audience || '';
    if (audience.includes('investor')) {
      const desk = SCENE_TEMPLATES.find(s => s.id === 'expert-desk');
      if (desk) setScene(desk);
    } else if (initialIdea.format === 'meme') {
      const aha = SCENE_TEMPLATES.find(s => s.id === 'aha-moment');
      if (aha) setScene(aha);
    } else if (initialIdea.format === 'news-reaction') {
      const policy = SCENE_TEMPLATES.find(s => s.id === 'government-policy');
      if (policy) setScene(policy);
    } else if (initialIdea.format === 'guide' || initialIdea.format === 'educational') {
      const doc = SCENE_TEMPLATES.find(s => s.id === 'document-discovery');
      if (doc) setScene(doc);
    }

    setIdeaBanner(`${initialIdea.day}'s idea loaded: "${initialIdea.topic}"`);
    setTimeout(() => setIdeaBanner(null), 6000);

    onIdeaConsumed?.();
  }, [initialIdea]);

  // Load saved images from IndexedDB and migrate from localStorage if needed
  useEffect(() => {
    const loadImages = async () => {
      try {
        // First, migrate any legacy localStorage images
        await migrateFromLocalStorage();

        // Load all images from IndexedDB
        const images = await getAllImages();
        setGeneratedImages(images.map(img => ({
          id: img.id,
          url: img.url,
          platform: img.platform,
          scene: img.theme, // theme field stores scene label
          prompt: img.prompt,
        })));

        // Update storage stats
        const stats = await getStorageStats();
        setStorageStats(stats);
      } catch (err) {
        console.error('Failed to load saved images:', err);
      }
    };

    loadImages();
  }, []);

  // Update storage stats when images change
  const updateStorageStats = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to update storage stats:', err);
    }
  };

  useEffect(() => {
    const settings = getOpenRouterSettings();
    if (settings.defaultModel) {
      setSelectedModel(settings.defaultModel);
    }
  }, []);

  // Update caption when type changes
  useEffect(() => {
    setCaption(CAPTION_TEMPLATES[captionType]);
  }, [captionType]);

  // Load OnlySocial accounts
  useEffect(() => {
    if (onlySocialConfigured) {
      setLoadingAccounts(true);
      listAccounts()
        .then(accounts => {
          setSocialAccounts(accounts);
          setSelectedAccounts(accounts.map(a => a.id));
        })
        .catch(err => {
          console.error('Failed to load OnlySocial accounts:', err);
        })
        .finally(() => {
          setLoadingAccounts(false);
        });
    }
  }, [onlySocialConfigured]);

  const buildPrompt = (): string => {
    // Priority: explicit imageTheme > extracted from post > scene concept only

    // Extract the core message/topic from the post if no explicit theme
    const extractTopicFromPost = (text: string): string => {
      if (!text) return '';
      // Get the first meaningful line (skip emojis-only lines)
      const lines = text.split('\n').filter(line => {
        const stripped = line.replace(/[^\w\s]/g, '').trim();
        return stripped.length > 5;
      });

      if (lines.length === 0) return '';

      // Take the first line and clean it up
      let topic = lines[0]
        .replace(/^[#@]\w+\s*/g, '') // Remove hashtags/mentions at start
        .replace(/[[\]{}]/g, '') // Remove brackets
        .replace(/\s+/g, ' ')
        .trim();

      // Limit length
      if (topic.length > 100) {
        topic = topic.substring(0, 100).replace(/\s\w+$/, '');
      }

      return topic;
    };

    // Use explicit theme first, then try to extract from post/caption
    const postContent = generatedPost || caption || '';
    const primaryTheme = imageTheme.trim() || extractTopicFromPost(postContent);

    // Build a blended prompt - theme drives the concept, scene provides visual setting
    const parts = [
      `Create a professional social media image for ${platform.platform}.`,
      `Format: ${platform.dimensions} (${platform.aspectRatio} aspect ratio).`,
    ];

    if (primaryTheme) {
      // Theme is the main driver, scene provides the visual setting
      parts.push(`Main subject/message: "${primaryTheme}".`);
      parts.push(`Visual setting to convey this message: ${scene.concept} - ${scene.keywords}.`);
    } else {
      // No theme provided, scene is the main concept
      parts.push(`Visual concept: ${scene.concept}. ${scene.keywords}.`);
    }

    // Custom context adds specificity
    if (customContext) {
      parts.push(`Additional details: ${customContext}.`);
    }

    parts.push(`Style: ${stylePreset.suffix}.`);
    parts.push('Technical: Single strong focal point, deliberate composition with rule of thirds, professional color grading, cinematic depth of field.');
    parts.push('Render in ultra high quality, 8K resolution, sharp focus, professional photography quality, no authentic elements.');

    return parts.join(' ');
  };

  const handleGenerate = async () => {
    if (!hasApiKey()) {
      setError('Please add your OpenRouter API key in Settings');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const aspectMap: Record<string, '16:9' | '1:1' | '9:16'> = {
        '16:9': '16:9',
        '1:1': '1:1',
        '9:16': '9:16',
        '1.91:1': '16:9',
        '4:3': '16:9',
      };

      const image = await generateImage({
        model: selectedModel,
        prompt: buildPrompt(),
        aspectRatio: aspectMap[platform.aspectRatio] || '1:1',
      });

      // Save to IndexedDB
      const storedImage = await saveImage({
        url: image.url,
        platform: platform.label,
        theme: scene.label, // Store scene as theme
        prompt: image.prompt,
      });

      setGeneratedImages(prev => [{
        id: storedImage.id,
        url: storedImage.url,
        platform: storedImage.platform,
        scene: storedImage.theme,
        prompt: storedImage.prompt,
      }, ...prev]);

      await updateStorageStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (img: { url: string }, filename: string) => {
    const link = document.createElement('a');
    link.href = img.url;
    link.download = `${filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.png`;
    link.click();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (confirm('Delete this image?')) {
      try {
        await deleteImage(imageId);
        setGeneratedImages(prev => prev.filter(img => img.id !== imageId));
        await updateStorageStats();
      } catch (err) {
        console.error('Failed to delete image:', err);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Clear all images? This cannot be undone.')) {
      try {
        await clearAllImages();
        setGeneratedImages([]);
        await updateStorageStats();
      } catch (err) {
        console.error('Failed to clear images:', err);
      }
    }
  };

  const handleScheduleToOnlySocial = async () => {
    if (!caption.trim()) {
      setScheduleResult({ success: false, message: 'Please enter a caption' });
      return;
    }

    if (selectedAccounts.length === 0) {
      setScheduleResult({ success: false, message: 'Please select at least one social account' });
      return;
    }

    setScheduling(true);
    setScheduleResult(null);

    try {
      const imageUrls = generatedImages.length > 0 ? [generatedImages[0].url] : [];

      await createPost(
        selectedAccounts,
        caption,
        imageUrls
      );

      setScheduleResult({
        success: true,
        message: `Post created in OnlySocial for ${selectedAccounts.length} account${selectedAccounts.length > 1 ? 's' : ''}`,
      });
    } catch (err) {
      setScheduleResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to create post in OnlySocial',
      });
    } finally {
      setScheduling(false);
    }
  };

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const apiKeyConfigured = hasApiKey();

  // Toggle platform selection for Create Post tab
  const togglePlatform = (p: SocialPlatformKey) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  // Generate draft post + image in parallel
  // Fetch page content for promote mode
  const handleFetchPage = async () => {
    if (!promoteUrl.trim()) return;

    // Normalize URL
    let url = promoteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setFetchingPage(true);
    setError(null);
    setFetchedPage(null);

    try {
      const page = await fetchPageContent(url);
      setFetchedPage(page);
      // Auto-fill concept with the page title for display purposes
      setPostConcept(page.title || url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page');
    } finally {
      setFetchingPage(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (createMode === 'promote') {
      if (!fetchedPage) {
        setError('Fetch the page first by clicking "Fetch Page"');
        return;
      }
    } else {
      if (!postConcept.trim()) {
        setError('Enter a post concept to get started');
        return;
      }
    }
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }
    if (!apiKeyConfigured) {
      setError('Add your OpenRouter API key in Settings first');
      return;
    }

    setError(null);
    setGeneratingText(true);
    setGeneratingImage(true);
    setGeneratedDraft(null);
    setDraftImage(null);
    setEditedDrafts({});

    // Build the appropriate prompt based on mode
    const userPrompt = createMode === 'promote' && fetchedPage
      ? buildPromotePrompt(fetchedPage, selectedPlatforms, targetState, postFormat)
      : buildUserPrompt(postConcept, selectedPlatforms, targetState, postFormat);

    const conceptForImage = createMode === 'promote' && fetchedPage
      ? (fetchedPage.title || fetchedPage.description || promoteUrl)
      : postConcept;

    // Find scene for image auto-generation
    const sceneId = autoSelectSceneId(conceptForImage, targetState);
    const matchedScene = SCENE_TEMPLATES.find(s => s.id === sceneId) || SCENE_TEMPLATES[0];

    // Fire BOTH in parallel
    const textPromise = generateText({
      model: selectedTextModel,
      prompt: userPrompt,
      systemPrompt: SOCIAL_POST_SYSTEM_PROMPT,
      maxTokens: 4096,
    });

    const imagePromise = generateImage({
      model: 'google/gemini-3-pro-image-preview' as ImageModel,
      prompt: buildAutoImagePrompt(conceptForImage, matchedScene.keywords, targetState),
      aspectRatio: '1:1',
      imageSize: '2K',
    });

    // Handle text result
    textPromise
      .then(result => {
        const draft = parseDraftResponse(result.content);
        setGeneratedDraft(draft);
        // Initialize editable drafts
        const editable: Record<string, string> = {};
        for (const p of selectedPlatforms) {
          if (draft[p]) editable[p] = draft[p]!;
        }
        setEditedDrafts(editable);
        // Set active platform to first available
        const firstAvailable = selectedPlatforms.find(p => draft[p]);
        if (firstAvailable) setActiveDraftPlatform(firstAvailable);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Text generation failed');
      })
      .finally(() => setGeneratingText(false));

    // Handle image result (non-blocking)
    imagePromise
      .then(async (image) => {
        setDraftImage(image);
        await saveImage({
          url: image.url,
          platform: 'AI Draft',
          theme: postConcept.slice(0, 50),
          prompt: image.prompt,
        });
        const images = await getAllImages();
        setGeneratedImages(images.map(img => ({
          id: img.id,
          url: img.url,
          platform: img.platform,
          scene: img.theme,
          prompt: img.prompt,
        })));
        await updateStorageStats();
      })
      .catch(err => {
        console.error('Image generation failed (non-blocking):', err);
      })
      .finally(() => setGeneratingImage(false));
  };

  // Copy draft for active platform
  const handleCopyDraft = () => {
    const text = editedDrafts[activeDraftPlatform] || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setDraftCopied(true);
    setTimeout(() => setDraftCopied(false), 2000);
  };

  // Download draft image
  const handleDownloadDraftImage = () => {
    if (!draftImage) return;
    const link = document.createElement('a');
    link.href = draftImage.url;
    link.download = `taxdrop-${postConcept.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`;
    link.click();
  };

  // Publish drafts via N8N → OnlySocial
  const handlePublishViaN8n = async () => {
    if (!editedDrafts || Object.keys(editedDrafts).length === 0) return;
    setPublishing(true);
    setPublishResult(null);
    setPublishError(null);

    try {
      const platforms: Record<string, string> = {};
      for (const p of selectedPlatforms) {
        if (editedDrafts[p]?.trim()) {
          platforms[p] = editedDrafts[p];
        }
      }

      // Upload image to OnlySocial first to get a public URL
      let imageUrl: string | undefined;
      if (draftImage?.url) {
        try {
          const resp = await fetch(draftImage.url);
          const blob = await resp.blob();
          const file = new File([blob], `social-image-${Date.now()}.png`, { type: blob.type || 'image/png' });
          const uploaded = await uploadMedia(file);
          imageUrl = uploaded.url;
        } catch (uploadErr) {
          console.warn('Image upload failed, publishing without image:', uploadErr);
        }
      }

      const result = await publishViaN8n({
        platforms,
        imageUrl,
        mode: 'now',
      });
      setPublishResult(result);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      {/* Queue banner — shown when Auto-Draft All was used */}
      {queueRemaining > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 16px',
          marginBottom: '8px',
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#C2410C',
          fontWeight: '600',
        }}>
          <span>⚡ <strong>{queueRemaining}</strong> more idea{queueRemaining !== 1 ? 's' : ''} queued. Finish drafting this post, then click "Next Idea" to load the next one.</span>
          <button
            onClick={() => onIdeaConsumed?.()}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #FED7AA',
              background: '#C2410C',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
          >
            Next Idea →
          </button>
        </div>
      )}

      {/* Trend Monitor idea banner */}
      {ideaBanner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: '#DFFFEA',
          border: '1px solid #0B8F52',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#065F46',
          fontWeight: '500',
        }}>
          <span style={{ fontSize: '18px' }}>📅</span>
          <span><strong>Trend Monitor idea loaded</strong> — {ideaBanner}. Concept, platforms, and format are pre-filled. Edit freely, then generate your draft below.</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '24px',
        borderBottom: '2px solid #E5E7EB',
      }}>
        {([
          { id: 'create' as GeneratorTab, label: 'Create Post' },
          { id: 'templates' as GeneratorTab, label: 'Templates & Tools' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--td-emerald-dark)' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.id ? 'var(--td-emerald-dark)' : '#6B7280',
              fontWeight: activeTab === tab.id ? '700' : '500',
              fontSize: '15px',
              cursor: 'pointer',
              marginBottom: '-2px',
              fontFamily: '"Space Grotesk", sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ CREATE POST TAB ============ */}
      {activeTab === 'create' && (
        <>
          {/* Card 1: Concept & Options */}
          <div className="card mb-lg">
            <div className="card-header">
              <h4>What's this post about?</h4>
            </div>
            <div className="card-body">
              {/* Mode Toggle */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '16px', background: '#F3F4F6', borderRadius: '8px', padding: '3px' }}>
                {([
                  { id: 'concept' as CreateMode, label: 'Write from Concept' },
                  { id: 'promote' as CreateMode, label: 'Promote a Link' },
                ]).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setCreateMode(mode.id);
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      background: createMode === mode.id ? 'white' : 'transparent',
                      color: createMode === mode.id ? 'var(--td-emerald-dark)' : '#6B7280',
                      fontWeight: createMode === mode.id ? '600' : '400',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: createMode === mode.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Concept mode: textarea */}
              {createMode === 'concept' && (
                <textarea
                  value={postConcept}
                  onChange={e => setPostConcept(e.target.value)}
                  placeholder="e.g., May 15 deadline is 2 weeks away — Texas homeowners need to act now"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '15px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
              )}

              {/* Promote mode: URL input */}
              {createMode === 'promote' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      value={promoteUrl}
                      onChange={e => {
                        setPromoteUrl(e.target.value);
                        setFetchedPage(null);
                      }}
                      placeholder="https://taxdrop.com/blog/your-article"
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleFetchPage(); }}
                    />
                    <button
                      onClick={handleFetchPage}
                      disabled={fetchingPage || !promoteUrl.trim()}
                      style={{
                        padding: '12px 20px',
                        background: fetchingPage ? '#9CA3AF' : 'var(--td-emerald-dark)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: fetchingPage ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fetchingPage ? 'Fetching...' : 'Fetch Page'}
                    </button>
                  </div>

                  {/* Fetched page preview */}
                  {fetchedPage && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      background: 'var(--td-mint)',
                      borderRadius: '8px',
                      border: '1px solid var(--td-emerald-light)',
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--td-emerald-dark)', marginBottom: '4px' }}>
                        {fetchedPage.title || 'Untitled Page'}
                      </div>
                      {fetchedPage.description && (
                        <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
                          {fetchedPage.description.slice(0, 200)}{fetchedPage.description.length > 200 ? '...' : ''}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px' }}>
                        {fetchedPage.bodyText ? `${fetchedPage.bodyText.split(' ').length} words extracted` : 'No body text found'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* State Selector */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
                  State Context
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([
                    { id: 'texas' as const, label: 'Texas (Protest)' },
                    { id: 'california' as const, label: 'California (Appeal)' },
                    { id: 'general' as const, label: 'General' },
                  ]).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setTargetState(s.id)}
                      style={{
                        padding: '8px 16px',
                        border: targetState === s.id ? '2px solid var(--td-emerald-light)' : '1px solid #D1D5DB',
                        borderRadius: '8px',
                        background: targetState === s.id ? 'var(--td-mint)' : 'white',
                        color: targetState === s.id ? 'var(--td-emerald-dark)' : '#374151',
                        fontWeight: targetState === s.id ? '600' : '400',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Post Format */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
                  Format (optional)
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {POST_FORMATS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setPostFormat(f.id)}
                      title={f.description}
                      style={{
                        padding: '6px 12px',
                        border: postFormat === f.id ? '2px solid var(--td-emerald-light)' : '1px solid #D1D5DB',
                        borderRadius: '20px',
                        background: postFormat === f.id ? 'var(--td-mint)' : 'white',
                        color: postFormat === f.id ? 'var(--td-emerald-dark)' : '#6B7280',
                        fontWeight: postFormat === f.id ? '600' : '400',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Model */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
                  AI Model
                </label>
                <select
                  value={selectedTextModel}
                  onChange={e => setSelectedTextModel(e.target.value as TextModel)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '13px',
                    background: 'white',
                  }}
                >
                  {TEXT_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Target Platforms */}
          <div className="card mb-lg">
            <div className="card-header">
              <h4>Platforms</h4>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {(Object.entries(PLATFORM_INFO) as [SocialPlatformKey, typeof PLATFORM_INFO[SocialPlatformKey]][]).map(([key, info]) => {
                  const selected = selectedPlatforms.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => togglePlatform(key)}
                      style={{
                        padding: '14px 12px',
                        border: selected ? '2px solid var(--td-emerald-light)' : '1px solid #D1D5DB',
                        borderRadius: '10px',
                        background: selected ? 'var(--td-mint)' : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '800',
                        color: selected ? 'var(--td-emerald-dark)' : '#9CA3AF',
                        marginBottom: '4px',
                        fontFamily: '"Space Grotesk", sans-serif',
                      }}>
                        {info.icon}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: selected ? '600' : '400',
                        color: selected ? 'var(--td-emerald-dark)' : '#6B7280',
                      }}>
                        {info.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 3: Generate Button */}
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={handleGenerateDraft}
              disabled={
                generatingText || generatingImage || selectedPlatforms.length === 0 ||
                (createMode === 'concept' && !postConcept.trim()) ||
                (createMode === 'promote' && !fetchedPage)
              }
              style={{
                width: '100%',
                padding: '16px',
                background: (generatingText || generatingImage) ? '#9CA3AF' : 'var(--td-emerald-dark)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: (generatingText || generatingImage) ? 'default' : 'pointer',
                fontFamily: '"Space Grotesk", sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {(generatingText || generatingImage)
                ? 'Generating...'
                : createMode === 'promote'
                  ? 'Generate Promo Post + Image'
                  : 'Generate Post + Image'}
            </button>

            {/* Loading indicators */}
            {(generatingText || generatingImage) && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
                <div style={{ fontSize: '13px', color: generatingText ? 'var(--td-emerald-light)' : '#10B981' }}>
                  {generatingText ? '⏳ Writing copy...' : '✓ Copy ready'}
                </div>
                <div style={{ fontSize: '13px', color: generatingImage ? 'var(--td-emerald-light)' : '#10B981' }}>
                  {generatingImage ? '⏳ Creating image...' : '✓ Image ready'}
                </div>
              </div>
            )}

            {error && <div className="form-error mt-md">{error}</div>}
          </div>

          {/* Card 4: Generated Drafts */}
          {(generatedDraft || generatingText) && (
            <div className="card mb-lg">
              <div className="card-header">
                <h4>Generated Drafts</h4>
              </div>
              <div className="card-body">
                {generatingText ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #E5E7EB',
                      borderTop: '3px solid var(--td-emerald-light)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    Writing platform-specific copy in TaxDrop's voice...
                  </div>
                ) : generatedDraft && (
                  <>
                    {/* Platform tabs */}
                    <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #E5E7EB', marginBottom: '16px' }}>
                      {selectedPlatforms.filter(p => generatedDraft[p] || editedDrafts[p]).map(p => (
                        <button
                          key={p}
                          onClick={() => setActiveDraftPlatform(p)}
                          style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeDraftPlatform === p ? '2px solid var(--td-emerald-dark)' : '2px solid transparent',
                            background: 'none',
                            color: activeDraftPlatform === p ? 'var(--td-emerald-dark)' : '#6B7280',
                            fontWeight: activeDraftPlatform === p ? '600' : '400',
                            fontSize: '13px',
                            cursor: 'pointer',
                            marginBottom: '-1px',
                          }}
                        >
                          {PLATFORM_INFO[p].label}
                        </button>
                      ))}
                    </div>

                    {/* Editable draft */}
                    <textarea
                      value={editedDrafts[activeDraftPlatform] || ''}
                      onChange={e => setEditedDrafts(prev => ({ ...prev, [activeDraftPlatform]: e.target.value }))}
                      rows={12}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    />

                    {/* Actions bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {(editedDrafts[activeDraftPlatform] || '').length} characters
                        {PLATFORM_INFO[activeDraftPlatform].charLimit && (
                          <span style={{
                            color: (editedDrafts[activeDraftPlatform] || '').length > PLATFORM_INFO[activeDraftPlatform].charLimit!
                              ? '#EF4444' : '#9CA3AF'
                          }}>
                            {' '}/ {PLATFORM_INFO[activeDraftPlatform].charLimit} max
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleCopyDraft}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: draftCopied ? '#10B981' : 'var(--td-emerald-light)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ width: '14px', height: '14px' }}>
                            {draftCopied ? <CheckIcon /> : <CopyIcon />}
                          </span>
                          {draftCopied ? 'Copied!' : 'Copy'}
                        </button>
                        {hasN8nWebhookUrl() && (
                          <button
                            onClick={handlePublishViaN8n}
                            disabled={publishing || selectedPlatforms.every(p => !editedDrafts[p]?.trim())}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              background: publishing ? '#9CA3AF' : publishResult?.success ? '#10B981' : 'var(--td-emerald-dark)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: publishing ? 'default' : 'pointer',
                            }}
                          >
                            {publishing ? 'Publishing...'
                              : publishResult?.success ? `Published (${publishResult.count})`
                              : 'Publish All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Publish result/error */}
                    {publishResult && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        background: publishResult.success ? 'var(--td-mint)' : '#FEE2E2',
                        color: publishResult.success ? 'var(--td-emerald-dark)' : '#DC2626',
                      }}>
                        {publishResult.success
                          ? `Published to ${Object.entries(publishResult.platforms).filter(([,v]) => v.success).map(([k]) => PLATFORM_INFO[k as SocialPlatformKey]?.label || k).join(', ')}`
                          : `Some platforms failed: ${Object.entries(publishResult.platforms).filter(([,v]) => !v.success).map(([k, v]) => `${k}: ${v.error}`).join('; ')}`
                        }
                      </div>
                    )}
                    {publishError && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        background: '#FEE2E2',
                        color: '#DC2626',
                      }}>
                        {publishError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Card 5: Generated Image */}
          {(draftImage || generatingImage) && (
            <div className="card mb-lg">
              <div className="card-header">
                <h4>Generated Image</h4>
              </div>
              <div className="card-body">
                {generatingImage ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #E5E7EB',
                      borderTop: '3px solid var(--td-emerald-light)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px',
                    }} />
                    Creating a matching image...
                  </div>
                ) : draftImage && (
                  <div>
                    <img
                      src={draftImage.url}
                      alt="Generated post image"
                      style={{
                        width: '100%',
                        maxWidth: '512px',
                        borderRadius: '8px',
                        display: 'block',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={handleDownloadDraftImage}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          background: 'var(--td-emerald-light)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ width: '14px', height: '14px' }}><DownloadIcon /></span>
                        Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ TEMPLATES & TOOLS TAB ============ */}
      {activeTab === 'templates' && (
        <>
      {/* Platform Selection */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Platform & Format</h4>
        </div>
        <div className="card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 'var(--spacing-sm)',
          }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p)}
                style={{
                  padding: '12px',
                  border: platform.id === p.id ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: platform.id === p.id ? 'var(--td-mint)' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{p.dimensions}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Image Style & Scene */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Image Style</h4>
        </div>
        <div className="card-body">
          {/* Style Presets */}
          <div className="form-group">
            <label className="form-label">Style Preset</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--spacing-sm)',
            }}>
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStylePreset(s)}
                  style={{
                    padding: '10px',
                    border: stylePreset.id === s.id ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: stylePreset.id === s.id ? 'var(--td-mint)' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Post Title / Image Theme - Primary driver for image content */}
          <div className="form-group">
            <label className="form-label">
              Post Title / Image Theme
              <span style={{ fontWeight: 'normal', color: 'var(--color-gray-500)', marginLeft: 8 }}>
                (drives the image subject)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              value={imageTheme}
              onChange={e => setImageTheme(e.target.value)}
              placeholder="e.g., Property tax deadline approaching, Save money on your home, Fighting unfair assessments"
              style={{
                borderColor: imageTheme ? 'var(--td-emerald-dark)' : undefined,
                background: imageTheme ? 'var(--td-mint)' : undefined,
              }}
            />
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Enter the main message or title of your post. This drives what the image is about. Leave blank to auto-extract from your post content.
            </p>
          </div>

          {/* Scene Templates */}
          <div className="form-group">
            <label className="form-label">
              Visual Setting
              <span style={{ fontWeight: 'normal', color: 'var(--color-gray-500)', marginLeft: 8 }}>
                (how to visually convey the theme)
              </span>
            </label>
            <select
              className="form-select"
              value={scene.id}
              onChange={e => setScene(SCENE_TEMPLATES.find(s => s.id === e.target.value) || SCENE_TEMPLATES[0])}
            >
              {SCENE_TEMPLATES.map(s => (
                <option key={s.id} value={s.id}>{s.label} — {s.concept}</option>
              ))}
            </select>
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Choose a visual setting that best represents your theme. Scene: {scene.keywords.slice(0, 80)}...
            </p>
          </div>

          {/* Custom Context */}
          <div className="form-group">
            <label className="form-label">Additional Details (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={customContext}
              onChange={e => setCustomContext(e.target.value)}
              placeholder="e.g., person wearing blue shirt, Texas-style home, holding coffee"
            />
          </div>
        </div>
      </div>

      {/* Generate */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4 className="flex items-center gap-sm">
            <ImageIcon />
            Generate Image
          </h4>
        </div>
        <div className="card-body">
          {!apiKeyConfigured ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
              <p className="text-gray mb-md">Add your OpenRouter API key in Settings to generate images.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--spacing-md)', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model</label>
                  <select
                    className="form-select"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value as ImageModel)}
                  >
                    {IMAGE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ height: 42 }}
                >
                  {generating ? 'Generating...' : 'Generate Image'}
                </button>
              </div>

              {error && <div className="form-error mt-md">{error}</div>}
            </>
          )}
        </div>
      </div>

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <div className="card mb-lg">
          <div className="card-header">
            <div className="flex items-center gap-md">
              <h4>Generated Images</h4>
              <span className="badge">{generatedImages.length}</span>
              {storageStats && (
                <span style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                  ({storageStats.estimatedSize})
                </span>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearAll}
              style={{ color: 'var(--color-error)' }}
            >
              Clear All
            </button>
          </div>
          <div className="card-body">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--spacing-md)',
            }}>
              {generatedImages.map((img) => (
                <div
                  key={img.id}
                  style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #E5E7EB',
                    background: '#F9FAFB',
                  }}
                >
                  <img
                    src={img.url}
                    alt={`${img.platform} - ${img.scene}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <div style={{ padding: 'var(--spacing-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{img.platform}</strong>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#666',
                          padding: '2px 6px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="text-sm text-gray" style={{ marginBottom: 8 }}>
                      {img.scene}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDownload(img, `${img.platform}-${img.scene}`)}
                    >
                      <DownloadIcon />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TypeShare Post Templates */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Post Templates (TypeShare Style)</h4>
          <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
            Structured long-form posts
          </span>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray mb-md">
            Proven post formats for LinkedIn and Twitter. Replace [brackets] with your content.
          </p>

          {/* Platform Filter */}
          <div className="form-group">
            <label className="form-label">Filter by Platform</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {(['all', 'linkedin', 'twitter'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setPostFilter(filter)}
                  style={{
                    padding: '6px 12px',
                    border: postFilter === filter ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                    borderRadius: '6px',
                    background: postFilter === filter ? 'var(--td-mint)' : 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: postFilter === filter ? '600' : '400',
                    textTransform: 'capitalize',
                  }}
                >
                  {filter === 'all' ? 'All' : filter === 'linkedin' ? 'LinkedIn' : 'Twitter/X'}
                </button>
              ))}
            </div>
          </div>

          {/* Template Selection */}
          <div className="form-group">
            <label className="form-label">Template</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-sm)',
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              {POST_TEMPLATES
                .filter(t => postFilter === 'all' || t.platform === postFilter || t.platform === 'both')
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setPostTemplate(t);
                      setGeneratedPost(t.template);
                    }}
                    style={{
                      padding: '10px',
                      border: postTemplate.id === t.id
                        ? '2px solid var(--td-emerald-dark)'
                        : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      background: postTemplate.id === t.id
                        ? 'var(--td-mint)'
                        : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: t.platform === 'linkedin' ? '#0A66C2' : t.platform === 'twitter' ? '#1DA1F2' : '#6B7280',
                        color: 'white',
                      }}>
                        {t.platform === 'both' ? 'All' : t.platform === 'linkedin' ? 'LI' : 'X'}
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '12px' }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>
                      {t.description}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Generated Post */}
          <div className="form-group">
            <label className="form-label flex justify-between">
              <span>Your Post</span>
              <div className="flex gap-sm">
                <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                  {generatedPost.length} chars
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPost);
                    setPostCopied(true);
                    setTimeout(() => setPostCopied(false), 2000);
                  }}
                >
                  {postCopied ? <CheckIcon /> : <CopyIcon />}
                  {postCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </label>
            <textarea
              className="form-textarea"
              value={generatedPost}
              onChange={e => setGeneratedPost(e.target.value)}
              rows={15}
              style={{ fontFamily: 'system-ui, sans-serif', fontSize: '14px', lineHeight: '1.5' }}
            />
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Replace [bracketed text] with your specific content. Property tax examples pre-filled.
            </p>
          </div>
        </div>
      </div>

      {/* Caption Templates */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Caption</h4>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Caption Type</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-sm)',
            }}>
              {(Object.keys(CAPTION_TEMPLATES) as Array<keyof typeof CAPTION_TEMPLATES>).map(type => (
                <button
                  key={type}
                  onClick={() => setCaptionType(type)}
                  style={{
                    padding: '6px 12px',
                    border: captionType === type ? '2px solid var(--td-emerald-dark)' : '1px solid #E5E7EB',
                    borderRadius: '6px',
                    background: captionType === type ? 'var(--td-mint)' : 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: captionType === type ? '600' : '400',
                  }}
                >
                  {type.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label flex justify-between">
              <span>Caption</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleCopy(caption, 'caption')}
              >
                {copied === 'caption' ? <CheckIcon /> : <CopyIcon />}
                Copy
              </button>
            </label>
            <textarea
              className="form-textarea"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Replace {'{placeholders}'} with your specific content
            </p>
          </div>
        </div>
      </div>

      {/* OnlySocial Scheduling */}
      <div className="card mb-lg">
        <div className="card-header">
          <h4>Schedule to OnlySocial</h4>
        </div>
        <div className="card-body">
          {!onlySocialConfigured ? (
            <div style={{
              padding: 'var(--spacing-md)',
              background: '#FEF3C7',
              borderRadius: '8px',
              fontSize: '14px',
            }}>
              Connect your OnlySocial account in Settings to schedule posts directly.
            </div>
          ) : (
            <>
              <p className="text-gray mb-md">
                Create a draft post in OnlySocial with your caption{generatedImages.length > 0 ? ' and generated image' : ''}.
              </p>

              {/* Account Selection */}
              <div className="form-group">
                <label className="form-label">Select Accounts</label>
                {loadingAccounts ? (
                  <p className="text-sm text-gray">Loading accounts...</p>
                ) : socialAccounts.length === 0 ? (
                  <p className="text-sm text-gray">No social accounts found. Connect accounts in OnlySocial first.</p>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-sm)',
                  }}>
                    {socialAccounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          border: selectedAccounts.includes(account.id)
                            ? '2px solid var(--td-emerald-dark)'
                            : '1px solid #E5E7EB',
                          borderRadius: '8px',
                          background: selectedAccounts.includes(account.id)
                            ? 'var(--td-mint)'
                            : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        {account.image && (
                          <img
                            src={account.image}
                            alt={account.name}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                            }}
                          />
                        )}
                        <span style={{ fontSize: '13px' }}>
                          {account.name}
                          <span style={{ color: 'var(--color-gray-500)', marginLeft: 4 }}>
                            ({account.provider})
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-md" style={{ marginTop: 'var(--spacing-md)' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleScheduleToOnlySocial}
                  disabled={scheduling || !caption.trim() || selectedAccounts.length === 0}
                >
                  {scheduling ? 'Creating...' : 'Create Draft in OnlySocial'}
                </button>
              </div>

              {scheduleResult && (
                <div style={{
                  marginTop: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  background: scheduleResult.success ? 'var(--td-mint)' : '#FEE2E2',
                  borderRadius: '8px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {scheduleResult.success ? <CheckIcon style={{ color: 'var(--td-emerald-dark)' }} /> : '×'}
                  <span>{scheduleResult.message}</span>
                  {scheduleResult.success && (
                    <a
                      href="https://app.onlysocial.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 'auto', color: 'var(--td-emerald-dark)' }}
                    >
                      Open OnlySocial →
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Comment Generator */}
      <div className="card">
        <div className="card-header">
          <h4>Comment Generator</h4>
          <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
            Engage authentically on others' posts
          </span>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray mb-md">
            Create thoughtful, value-adding comments to engage with relevant content.
          </p>

          {/* Comment Type Selection */}
          <div className="form-group">
            <label className="form-label">Comment Type</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-sm)',
            }}>
              {COMMENT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setCommentTemplate(t);
                    setGeneratedComment(t.template);
                  }}
                  style={{
                    padding: '10px',
                    border: commentTemplate.id === t.id
                      ? '2px solid var(--td-emerald-dark)'
                      : '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: commentTemplate.id === t.id
                      ? 'var(--td-mint)'
                      : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: 2, fontSize: '12px' }}>{t.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context hint */}
          <div style={{
            padding: 'var(--spacing-sm)',
            background: '#F3F4F6',
            borderRadius: '6px',
            marginBottom: 'var(--spacing-md)',
            fontSize: '12px',
          }}>
            <strong>When to use:</strong> {commentTemplate.context}
          </div>

          {/* Generated Comment */}
          <div className="form-group">
            <label className="form-label flex justify-between">
              <span>Your Comment</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedComment);
                  setCommentCopied(true);
                  setTimeout(() => setCommentCopied(false), 2000);
                }}
                disabled={!generatedComment}
              >
                {commentCopied ? <CheckIcon /> : <CopyIcon />}
                {commentCopied ? 'Copied!' : 'Copy'}
              </button>
            </label>
            <textarea
              className="form-textarea"
              value={generatedComment}
              onChange={e => setGeneratedComment(e.target.value)}
              rows={3}
              placeholder="Select a comment type above to get a template..."
            />
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Replace {'{placeholders}'} with specific details
            </p>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

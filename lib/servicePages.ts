// Editorial descriptions for the main platforms. Prices and limits come from the existing catalog.
export const servicePages = [
  {
    slug: "facebook", platform: "Facebook",
    title: "Facebook Boosting Services in Nepal",
    description: "Compare Facebook followers, page likes, video views and watch-time prices in Nepal. Choose a quantity, check the total in NPR and pay with eSewa.",
    heading: "Facebook services, with prices upfront.",
    intro: "Compare page followers, post reactions, video views and watch time in one place. Pick the service for the page or content you want to work on, then choose your quantity.",
    notes: [
      { title: "Page followers or post engagement?", text: "Page followers apply to your page or public profile. Likes, reactions and shares apply to a specific post. Choose the matching service and use the right public link." },
      { title: "Video views and watch time are different", text: "Views count video plays; watch time measures time spent watching. Buying either does not guarantee monetization approval. Facebook decides eligibility and which activity counts." },
      { title: "Check the refill option", text: "Some follower services include refill coverage for drops after delivery. Coverage varies by service. Ask us about the period and conditions before paying." },
    ],
  },
  {
    slug: "instagram", platform: "Instagram",
    title: "Instagram Followers & Reel Views in Nepal",
    description: "See Instagram follower, reel-view and like prices in NPR. Compare refill options, order quantities and pay with eSewa. No Instagram password required.",
    heading: "Choose what your Instagram account needs.",
    intro: "Browse followers for your profile, views and likes for reels, and services for stories and posts. Compare the rate and order limits before choosing an option.",
    notes: [
      { title: "Use a profile link for followers", text: "Followers are delivered to the Instagram profile you provide. Reel views and likes need the individual reel or post link. Keep the relevant profile or content public during delivery." },
      { title: "Compare follower coverage", text: "The catalog has follower options with different refill periods. Refill means replacing followers that drop under the service's coverage conditions; it does not promise permanent follower counts." },
      { title: "Views, reach and impressions", text: "Video views refer to plays. Reach refers to accounts that see content, and impressions refer to the number of times it is displayed. These are separate services, so choose the metric you need." },
    ],
  },
  {
    slug: "youtube", platform: "YouTube",
    title: "YouTube Subscribers & Watch Time in Nepal",
    description: "Compare YouTube subscribers, video views, Shorts views and watch-time services in Nepal. See NPR pricing and quantity limits before paying with eSewa.",
    heading: "YouTube subscribers, views and watch time.",
    intro: "Find separate services for your channel, regular videos, Shorts and live streams. Check what each option covers and which link it requires before placing an order.",
    notes: [
      { title: "Match the service to your content", text: "Subscriber services need your channel link. Video and Shorts services need a link to the specific content. Watch-time options are listed separately from views." },
      { title: "Watch hours do not guarantee YPP approval", text: "YouTube decides which activity counts and whether a channel qualifies for its Partner Program. A purchase does not guarantee eligible hours, monetization approval or advertising revenue." },
      { title: "Read the order limits first", text: "Quantity units differ between subscriber, view and watch-time services. The calculator shows the allowed range and total for your chosen option. If availability is unconfirmed, contact us before paying." },
    ],
  },
  {
    slug: "tiktok", platform: "TikTok",
    title: "TikTok Followers, Likes & Views in Nepal",
    description: "Compare TikTok follower, video-like and view services in Nepal. Check prices in NPR, choose your quantity and pay through eSewa or your account wallet.",
    heading: "TikTok services for your profile and videos.",
    intro: "Compare followers, video views, likes, shares and saves. Each service has its own quantity range, so you can see the exact cost before moving to checkout.",
    notes: [
      { title: "Profile and video orders use different links", text: "Use your public profile link for followers and the specific video link for views, likes, shares or saves. Check the link carefully before submitting your order." },
      { title: "A view is not a promise of virality", text: "These services add the metric listed in the order. They do not guarantee that TikTok will recommend your video, that viewers will become customers or that your account will earn revenue." },
      { title: "Ask about live services before ordering", text: "Live viewers and battle-related services depend on timing and availability. Contact us with the service name and your planned live time so we can confirm the details." },
    ],
  },
] as const;

export const orderQuestions = [
  { question: "How do I order social media boosting in Nepal?", answer: "Choose a platform, category and service, enter a quantity within its limits, and check your total in NPR. At checkout, provide the public profile or content link and choose direct eSewa payment or your account wallet." },
  { question: "Do I need to share my social media password?", answer: "No. We ask for the public profile, page, video or post link required for your selected service. Never send your password or a sign-in code." },
  { question: "How are eSewa payments and wallet deposits confirmed?", answer: "Our team reviews the payment details you submit. An eSewa submission is not an instant payment approval. Wallet deposits become available after approval; sign in to add funds and view your payment history." },
  { question: "Can I choose any quantity?", answer: "Choose a whole number between the minimum and maximum shown for your service. Limits and units vary. The calculator updates your total as you change the quantity; the displayed rate is not always the minimum order price." },
  { question: "How long will delivery take?", answer: "Timing varies by service, quantity and availability. Default delivery uses the service's normal timeframe. If a timed-delivery option is available after payment approval, you can request a schedule. A requested schedule is not a guarantee of an exact completion time." },
  { question: "Will these services guarantee monetization or real customers?", answer: "No. Social platforms decide monetization eligibility and which activity counts. A follower, view or watch-time order does not guarantee approval, organic engagement, sales or revenue. Review the platform's rules before ordering." },
] as const;

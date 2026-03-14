import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Shield, Users, Heart, Beaker, Cookie, Database, AlertOctagon, Accessibility } from "lucide-react";

const POLICIES = {
  terms: {
    title: "Terms of Service",
    icon: FileText,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: "By accessing or using StarThread, you agree to be bound by these Terms of Service. If you do not agree, you may not use the service. StarThread is designed for families to organize, connect, and preserve their shared experiences."
      },
      {
        heading: "2. Eligibility",
        body: "You must be at least 13 years of age to create an account. Users under 18 must have a parent or guardian who agrees to these terms on their behalf. Child and teen accounts are subject to parental controls as described in our Safety Policy."
      },
      {
        heading: "3. Your Account",
        body: "You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information and to update it as necessary. You may not share your account with others or create accounts on behalf of others without their consent."
      },
      {
        heading: "4. User Content",
        body: "You retain ownership of content you upload to StarThread, including photos, stories, and messages. By uploading content, you grant StarThread a limited license to store, display, and process that content solely for the purpose of providing the service to you and your family members."
      },
      {
        heading: "5. Acceptable Use",
        body: "You agree not to use StarThread to harass, abuse, or harm others; upload illegal or harmful content; attempt to gain unauthorized access to other accounts; or use the service for commercial purposes without authorization."
      },
      {
        heading: "6. Privacy",
        body: "Your use of StarThread is also governed by our Privacy Policy. We are committed to protecting the personal information of all users, with special attention to the data of minors."
      },
      {
        heading: "7. Service Modifications",
        body: "StarThread reserves the right to modify, suspend, or discontinue the service at any time. During the beta period, features may change significantly. We will provide reasonable notice of material changes."
      },
      {
        heading: "8. Termination",
        body: "You may delete your account at any time through Settings. StarThread may suspend or terminate accounts that violate these terms. Upon termination, your data will be handled in accordance with our Privacy Policy."
      },
      {
        heading: "9. Limitation of Liability",
        body: "StarThread is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service."
      },
      {
        heading: "10. Contact",
        body: "For questions about these Terms of Service, please contact us at support@starthread.app."
      }
    ]
  },
  privacy: {
    title: "Privacy Policy",
    icon: Shield,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "1. Information We Collect",
        body: "We collect information you provide directly: name, email, birth date, photos, family relationships, and content you create. We also collect usage data such as login times and feature usage to improve the service."
      },
      {
        heading: "2. How We Use Your Information",
        body: "Your information is used to provide and improve StarThread's features, manage your account, facilitate family connections, send important service notifications, and ensure the safety of all users, especially minors."
      },
      {
        heading: "3. Information Sharing",
        body: "We do not sell your personal information. Information is shared only with family members you connect with (subject to your privacy settings), service providers who assist in operating StarThread, and when required by law."
      },
      {
        heading: "4. Privacy Controls",
        body: "StarThread provides granular privacy controls. You can set your profile visibility to public, family-only, or private. You can control which relationships are visible and manage per-relationship visibility settings."
      },
      {
        heading: "5. Children's Privacy",
        body: "We take children's privacy seriously. Accounts for users under 13 are not permitted. Teen accounts (13-17) are subject to parental controls. Guardians can manage feature access, monitor messages, and control privacy settings for minor accounts."
      },
      {
        heading: "6. Data Security",
        body: "We use industry-standard security measures including encrypted sessions, CSRF protection, rate limiting, and secure password hashing (bcrypt). All data is transmitted over HTTPS."
      },
      {
        heading: "7. Data Export & Deletion",
        body: "You can export your personal data as JSON from Settings at any time. You can delete your account, which will remove your user credentials. Family data you created may be retained if other family members still reference it."
      },
      {
        heading: "8. Cookies & Sessions",
        body: "StarThread uses session cookies to maintain your login state. We do not use third-party tracking cookies or advertising cookies."
      },
      {
        heading: "9. Changes to This Policy",
        body: "We may update this Privacy Policy from time to time. We will notify users of significant changes through the application or by email."
      },
      {
        heading: "10. Contact",
        body: "For privacy-related questions or to exercise your data rights, contact us at privacy@starthread.app."
      }
    ]
  },
  community: {
    title: "Community Guidelines",
    icon: Users,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "Our Mission",
        body: "StarThread exists to help families stay connected, organized, and preserve their shared memories. These guidelines help ensure a safe and welcoming environment for all family members."
      },
      {
        heading: "Respect & Kindness",
        body: "Treat all family members with respect and kindness. StarThread is a space for connection and love, not conflict. Use love notes and messages to build up your family relationships."
      },
      {
        heading: "Accurate Information",
        body: "Provide accurate information about yourself and family members. Do not create profiles for people who are not part of your family. Respect the identity and preferences of all family members."
      },
      {
        heading: "Content Standards",
        body: "Keep all content family-friendly. Photos, stories, and messages should be appropriate for all ages. Do not upload content that is violent, hateful, sexually explicit, or otherwise harmful."
      },
      {
        heading: "Privacy Respect",
        body: "Respect the privacy settings of other family members. Do not share information from private profiles outside of StarThread. Obtain consent before adding family members or sharing their information."
      },
      {
        heading: "Minor Safety",
        body: "Adults bear responsibility for the safety of minors on the platform. Use parental controls appropriately. Report any concerning behavior involving minors immediately."
      },
      {
        heading: "Reporting Issues",
        body: "If you encounter content or behavior that violates these guidelines, contact us at support@starthread.app. We will investigate and take appropriate action."
      }
    ]
  },
  safety: {
    title: "Safety Policy",
    icon: Heart,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "Our Commitment to Safety",
        body: "StarThread is committed to providing a safe environment for families of all sizes and compositions. Safety is built into every feature, with special protections for minors."
      },
      {
        heading: "Account Security",
        body: "All passwords must be at least 8 characters. Sessions are managed securely with automatic expiration. Password changes invalidate all other active sessions. Google OAuth is available as a secure alternative login method."
      },
      {
        heading: "Minor Protections",
        body: "Children under 13 cannot create accounts. Teen accounts (13-17) include parental controls that allow guardians to manage feature access (messaging, moments, trips, etc.), monitor conversations, and control privacy settings."
      },
      {
        heading: "Memorial Profiles",
        body: "StarThread provides a dignified memorial flow for deceased family members. Memorial profiles require multi-factor confirmation and are given special visual treatment. Only the profile creator and guardians retain edit access."
      },
      {
        heading: "Data Protection",
        body: "Row-level security ensures users can only access data they are authorized to see. Medical notes are segregated to private endpoints. Invite links are scoped to their creators. Privacy levels (public, family, private) control profile visibility."
      },
      {
        heading: "Relationship Verification",
        body: "Family relationships require verification from both parties before being fully established. This prevents unauthorized connections and ensures the integrity of family trees."
      },
      {
        heading: "Support Access",
        body: "If you need support assistance, you can generate a temporary support access token from Settings. This token grants limited, time-bound access to your profile data for troubleshooting purposes only."
      }
    ]
  },
  beta: {
    title: "Beta Program",
    icon: Beaker,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "What is the Beta Program?",
        body: "StarThread is currently in beta, meaning the product is actively being developed and improved. Beta participants get early access to all premium features and help shape the future of the platform through their feedback."
      },
      {
        heading: "Beta Benefits",
        body: "During the beta period, all participants receive full access to premium features at no cost. This includes unlimited family members, all trip planning features, full messaging capabilities, and advanced privacy controls."
      },
      {
        heading: "Providing Feedback",
        body: "Your feedback is invaluable. You can provide feedback through the support channel or by contacting feedback@starthread.app. Bug reports, feature suggestions, and general impressions are all welcome."
      },
      {
        heading: "Post-Beta Transition",
        body: "When StarThread exits beta, participants will receive a discount on premium subscription plans as a thank you for their early support. Your data and family connections will be preserved through the transition."
      },
      {
        heading: "Beta Limitations",
        body: "As a beta product, StarThread may experience occasional bugs, downtime, or feature changes. We do our best to minimize disruptions and will communicate any significant changes in advance."
      },
      {
        heading: "Joining & Leaving",
        body: "You can join or leave the beta program at any time from the Beta tab in Settings. Leaving the beta program will not affect your account or data, but you may lose access to premium features."
      }
    ]
  },
  cookies: {
    title: "Cookie Policy",
    icon: Cookie,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "What Are Cookies",
        body: "Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience."
      },
      {
        heading: "How StarThread Uses Cookies",
        body: "StarThread uses only essential session cookies to keep you logged in securely. We use a single session cookie managed by our server to maintain your authenticated state across page visits."
      },
      {
        heading: "Types of Cookies We Use",
        body: "We use strictly necessary cookies only. Our session cookie (connect.sid) is required for authentication and cannot be disabled. We do not use analytics cookies, advertising cookies, or any third-party tracking cookies."
      },
      {
        heading: "Local Storage",
        body: "StarThread uses browser local storage to save your UI preferences such as 3D quality settings and sidebar state. This data never leaves your device and is not shared with any third party."
      },
      {
        heading: "Cookie Duration",
        body: "Our session cookie expires when your server session ends or after the configured session timeout. You can clear cookies at any time through your browser settings, which will log you out of StarThread."
      },
      {
        heading: "Managing Cookies",
        body: "You can configure your browser to block or delete cookies. However, blocking the essential session cookie will prevent you from logging into StarThread. For instructions on managing cookies, refer to your browser's help documentation."
      }
    ]
  },
  "data-retention": {
    title: "Data Retention Policy",
    icon: Database,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "Overview",
        body: "StarThread retains your personal data only for as long as necessary to provide our services, comply with legal obligations, and resolve disputes. This policy outlines how long we keep different types of data."
      },
      {
        heading: "Account Data",
        body: "Your account information (email, name, password hash) is retained for the duration of your account. Upon account deletion, your user credentials are permanently removed. Your associated person profile may be retained if other family members reference it, but it will be unlinked from your account."
      },
      {
        heading: "Family Data",
        body: "Content you create, including family stories, moments, love notes, trip plans, and traditions, is retained as long as your account is active. Shared content that involves other family members may be retained even after your account deletion to preserve the integrity of shared family records."
      },
      {
        heading: "Messages",
        body: "Messages are retained as part of conversation history for all participants. If you delete your account, your messages remain visible to other conversation participants but your identity may be anonymized."
      },
      {
        heading: "Session & Security Data",
        body: "Session records are automatically purged when they expire. Login attempts and security events are retained for 90 days for security monitoring purposes."
      },
      {
        heading: "Memorial Profiles",
        body: "Memorial profiles for deceased family members are retained indefinitely to preserve family history. The creator of a memorial profile retains permanent edit rights. Memorial profiles can only be removed by the creator or a system administrator."
      },
      {
        heading: "Data Export",
        body: "You can export all of your personal data at any time from the Settings page. The export includes your profile information, content you created, and your relationship connections in JSON format."
      },
      {
        heading: "Deletion Requests",
        body: "To request complete deletion of all your data, including shared content, contact us at privacy@starthread.app. We will process deletion requests within 30 days, subject to legal retention requirements."
      }
    ]
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    icon: AlertOctagon,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "Purpose",
        body: "This Acceptable Use Policy defines the rules and boundaries for using StarThread. It supplements our Terms of Service and Community Guidelines to ensure a safe, respectful environment for all families."
      },
      {
        heading: "Permitted Uses",
        body: "StarThread is designed for legitimate family organization and connection. Permitted uses include managing family profiles and relationships, planning trips and family events, sharing photos and memories, sending love notes and messages to family members, preserving family stories and traditions, and tracking birthdays and milestones."
      },
      {
        heading: "Prohibited Content",
        body: "You may not upload, share, or create content that is sexually explicit or pornographic, promotes violence, self-harm, or illegal activities, contains hate speech or discrimination, infringes on intellectual property rights, contains malware or malicious code, or is deliberately misleading or fraudulent."
      },
      {
        heading: "Prohibited Behavior",
        body: "You may not use StarThread to harass, bully, stalk, or intimidate others, create fake profiles or impersonate real people, attempt to access other users' accounts or data, use automated tools to scrape or collect data, exploit vulnerabilities in the platform, or circumvent parental controls or safety features."
      },
      {
        heading: "Account Integrity",
        body: "Each user should maintain only one account. Creating multiple accounts to evade bans, manipulate features, or deceive others is prohibited. Sharing account credentials with others is not permitted."
      },
      {
        heading: "Minor-Specific Rules",
        body: "Adults must not attempt to contact minors outside of legitimate family relationships. Parental controls must not be circumvented. Content involving minors must be appropriate and shared only within verified family connections."
      },
      {
        heading: "Enforcement",
        body: "Violations of this policy may result in content removal, account suspension, or permanent account termination. Severe violations may be reported to law enforcement. We reserve the right to take action at our discretion to protect the safety of our community."
      },
      {
        heading: "Reporting Violations",
        body: "If you encounter content or behavior that violates this policy, report it immediately to abuse@starthread.app. Include as much detail as possible to help us investigate promptly."
      }
    ]
  },
  accessibility: {
    title: "Accessibility Statement",
    icon: Accessibility,
    lastUpdated: "March 1, 2026",
    sections: [
      {
        heading: "Our Commitment",
        body: "StarThread is committed to ensuring digital accessibility for people of all abilities. We are continually improving the user experience for everyone and applying relevant accessibility standards."
      },
      {
        heading: "Standards",
        body: "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines help make web content more accessible to people with disabilities, including visual, auditory, physical, speech, cognitive, and neurological disabilities."
      },
      {
        heading: "Accessibility Features",
        body: "StarThread includes keyboard navigation support throughout the application, semantic HTML structure for screen reader compatibility, sufficient color contrast ratios for text readability, form labels and error messages for input fields, focus indicators for interactive elements, and responsive design that adapts to different screen sizes and zoom levels."
      },
      {
        heading: "3D Visualization Accessibility",
        body: "Our Family Universe 3D view may present challenges for users with certain disabilities. We provide a List View alternative that presents the same family data in a fully accessible table format. Users can switch between 3D and List views at any time."
      },
      {
        heading: "Known Limitations",
        body: "While we strive for full accessibility, some areas of StarThread are still being improved. The 3D WebGL Family Universe relies on visual rendering that may not be fully accessible to screen readers. We provide alternative views (List, Lineage) for all 3D content."
      },
      {
        heading: "Feedback",
        body: "We welcome your feedback on the accessibility of StarThread. If you encounter accessibility barriers or have suggestions for improvement, please contact us at accessibility@starthread.app. We take all feedback seriously and will work to address issues promptly."
      },
      {
        heading: "Third-Party Content",
        body: "While we strive to ensure accessibility of StarThread itself, we cannot guarantee the accessibility of third-party content or integrations (such as Google Calendar sync). We encourage third-party providers to maintain their own accessibility standards."
      }
    ]
  }
};

const POLICY_LIST = [
  { key: 'terms', title: 'Terms of Service', description: 'Read our terms and conditions for using StarThread.', icon: FileText },
  { key: 'privacy', title: 'Privacy Policy', description: 'Learn how we collect, use, and protect your personal information.', icon: Shield },
  { key: 'community', title: 'Community Guidelines', description: 'Standards for respectful, safe family interactions.', icon: Users },
  { key: 'safety', title: 'Safety Policy', description: 'How we protect you and your family, especially minors.', icon: Heart },
  { key: 'cookies', title: 'Cookie Policy', description: 'How we use cookies and local storage on StarThread.', icon: Cookie },
  { key: 'data-retention', title: 'Data Retention Policy', description: 'How long we keep your data and how to request deletion.', icon: Database },
  { key: 'acceptable-use', title: 'Acceptable Use Policy', description: 'Rules and boundaries for using StarThread responsibly.', icon: AlertOctagon },
  { key: 'accessibility', title: 'Accessibility Statement', description: 'Our commitment to making StarThread accessible to everyone.', icon: Accessibility },
  { key: 'beta', title: 'Beta Program', description: 'What the beta means and how to provide feedback.', icon: Beaker },
];

function PolicyIndex() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Policies & Trust Center</h1>
        <p className="text-slate-400 mt-1">Our commitment to transparency, safety, and your privacy.</p>
      </div>
      <div className="space-y-3">
        {POLICY_LIST.map(({ key, title, description, icon: Icon }) => (
          <Link
            key={key}
            to={`/policies/${key}`}
            className="flex items-start gap-4 p-5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 group"
          >
            <Icon className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">{title}</h3>
              <p className="text-sm text-slate-400 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PolicyDetail({ policyKey }) {
  const policy = POLICIES[policyKey];
  if (!policy) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-slate-400">Policy not found.</p>
        <Link to="/policies" className="text-amber-400 hover:text-amber-300 mt-2 inline-block">Back to Policies</Link>
      </div>
    );
  }
  const Icon = policy.icon;
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link to="/policies" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" />
        Back to Policies
      </Link>
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{policy.title}</h1>
          <p className="text-xs text-slate-500">Last updated: {policy.lastUpdated}</p>
        </div>
      </div>
      <div className="space-y-6">
        {policy.sections.map((section, i) => (
          <div key={i} className="glass-card rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-2">{section.heading}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Policies() {
  const { policyKey } = useParams();
  if (policyKey) return <PolicyDetail policyKey={policyKey} />;
  return <PolicyIndex />;
}

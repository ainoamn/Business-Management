import type { Locale } from '@work/shared-types';

export interface MarketingContent {
  // Navigation
  features: string;
  solutions: string;
  industries: string;
  pricing: string;
  templates: string;
  about: string;
  contact: string;
  security: string;
  privacy: string;
  terms: string;
  help: string;
  login: string;
  register: string;
  workspace: string;
  getStarted: string;
  learnMore: string;
  
  // Features Page
  featuresTitle: string;
  featuresLead: string;
  featuresWorkflows: string;
  featuresWorkflowsDesc: string;
  featuresAi: string;
  featuresAiDesc: string;
  featuresReports: string;
  featuresReportsDesc: string;
  featuresDocuments: string;
  featuresDocumentsDesc: string;
  featuresFinance: string;
  featuresFinanceDesc: string;
  featuresMeetings: string;
  featuresMeetingsDesc: string;
  
  // Solutions Page
  solutionsTitle: string;
  solutionsLead: string;
  solutionsOperations: string;
  solutionsOperationsDesc: string;
  solutionsProjects: string;
  solutionsProjectsDesc: string;
  solutionsHr: string;
  solutionsHrDesc: string;
  solutionsCustomer: string;
  solutionsCustomerDesc: string;
  
  // Industries Page
  industriesTitle: string;
  industriesLead: string;
  industriesGov: string;
  industriesGovDesc: string;
  industriesFinance: string;
  industriesFinanceDesc: string;
  industriesHealth: string;
  industriesHealthDesc: string;
  industriesEdu: string;
  industriesEduDesc: string;
  
  // Pricing Page
  pricingTitle: string;
  pricingLead: string;
  pricingLoadError: string;
  pricingNoteApi: string;
  pricingNotePayment: string;
  pricingPerMonth: string;
  pricingSeats: string;
  pricingStorage: string;
  pricingAi: string;
  
  // Templates Page
  templatesTitle: string;
  templatesLead: string;
  templatesAvailable: string;
  
  // About Page
  aboutTitle: string;
  aboutLead: string;
  aboutMission: string;
  aboutMissionDesc: string;
  aboutVision: string;
  aboutVisionDesc: string;
  aboutValues: string;
  aboutValuesDesc: string;
  
  // Contact Page
  contactTitle: string;
  contactLead: string;
  contactName: string;
  contactEmail: string;
  contactMessage: string;
  contactSend: string;
  contactSending: string;
  contactSuccess: string;
  contactError: string;
  contactRequired: string;
  
  // Security Page
  securityTitle: string;
  securityLead: string;
  securityDraft: string;
  securityEncryption: string;
  securityEncryptionDesc: string;
  securityAccess: string;
  securityAccessDesc: string;
  securityAudit: string;
  securityAuditDesc: string;
  securityCompliance: string;
  securityComplianceDesc: string;
  
  // Privacy Page
  privacyTitle: string;
  privacyLead: string;
  privacyDraft: string;
  privacyCollection: string;
  privacyCollectionDesc: string;
  privacyUsage: string;
  privacyUsageDesc: string;
  privacyRetention: string;
  privacyRetentionDesc: string;
  privacyRights: string;
  privacyRightsDesc: string;
  
  // Terms Page
  termsTitle: string;
  termsLead: string;
  termsDraft: string;
  termsAcceptance: string;
  termsAcceptanceDesc: string;
  termsService: string;
  termsServiceDesc: string;
  termsLimitations: string;
  termsLimitationsDesc: string;
  termsTermination: string;
  termsTerminationDesc: string;
  
  // Help Page
  helpTitle: string;
  helpLead: string;
  helpGettingStarted: string;
  helpGettingStartedDesc: string;
  helpWorkflows: string;
  helpWorkflowsDesc: string;
  helpIntegrations: string;
  helpIntegrationsDesc: string;
  helpSupport: string;
  helpSupportDesc: string;
}

const ar: MarketingContent = {
  features: 'المميزات',
  solutions: 'الحلول',
  industries: 'القطاعات',
  pricing: 'الأسعار',
  templates: 'القوالب',
  about: 'من نحن',
  contact: 'اتصل بنا',
  security: 'الأمان',
  privacy: 'الخصوصية',
  terms: 'الشروط',
  help: 'المساعدة',
  login: 'تسجيل الدخول',
  register: 'إنشاء حساب',
  workspace: 'مساحة العمل',
  getStarted: 'ابدأ الآن',
  learnMore: 'معرفة المزيد',
  
  featuresTitle: 'مميزات متكاملة لإدارة أعمالك',
  featuresLead: 'منصة شاملة توفر كل ما تحتاجه لإدارة المشاريع والعمليات اليومية بكفاءة ودقة.',
  featuresWorkflows: 'مسارات العمل الآلية',
  featuresWorkflowsDesc: 'صمم مسارات عمل مخصصة بأدوات مرئية، مع دعم الشروط والمراحل المتعددة والموافقات الآلية. كل مسار يتكيف مع احتياجات عملك الفعلية.',
  featuresAi: 'الذكاء الاصطناعي المدمج',
  featuresAiDesc: 'استفد من مقترحات ذكية لإكمال البيانات، تلخيص المستندات، وإجابات فورية عن استفساراتك. الذكاء الاصطناعي يحتاج إلى إعداد مزود خارجي.',
  featuresReports: 'تقارير تفصيلية',
  featuresReportsDesc: 'تقارير قابلة للتخصيص تشمل تقدم المشاريع، استهلاك الموارد، والمؤشرات المالية. تصدير مباشر بصيغ متعددة لمتابعة دقيقة.',
  featuresDocuments: 'إدارة المستندات',
  featuresDocumentsDesc: 'رفع ومشاركة المستندات مع دعم المعاينة الفورية، التحكم بالصلاحيات، وربط المرفقات بطلبات العمل والمشاريع.',
  featuresFinance: 'الإدارة المالية',
  featuresFinanceDesc: 'تتبع النفقات، إنشاء فواتير، ورصد الميزانيات ضمن مساحة عملك. كل عملية مالية مرتبطة بالمشاريع والأنشطة.',
  featuresMeetings: 'إدارة الاجتماعات',
  featuresMeetingsDesc: 'جدولة الاجتماعات، تسجيل المحاضر، وربط القرارات بمهام قابلة للتنفيذ. كل اجتماع له سجل كامل وقرارات متابعة.',
  
  solutionsTitle: 'حلول مصممة لاحتياجات عملك',
  solutionsLead: 'سواء كنت تدير مشاريع، عمليات تشغيلية، أو فريق عمل، نوفر لك الأدوات المناسبة.',
  solutionsOperations: 'إدارة العمليات',
  solutionsOperationsDesc: 'أتمتة الطلبات الداخلية، إدارة الصلاحيات، ومتابعة الأداء التشغيلي. حلول مبنية لتحسين الكفاءة اليومية.',
  solutionsProjects: 'إدارة المشاريع',
  solutionsProjectsDesc: 'تخطيط المشاريع، توزيع المهام، ومتابعة التقدم بشكل مباشر. أدوات تتكيف مع حجم وتعقيد مشاريعك.',
  solutionsHr: 'الموارد البشرية',
  solutionsHrDesc: 'إدارة الإجازات، الحضور، وطلبات الموظفين ضمن مسارات عمل آلية. تبسيط العمليات الإدارية للفريق.',
  solutionsCustomer: 'خدمة العملاء',
  solutionsCustomerDesc: 'استقبال الطلبات، متابعة الحالات، وإدارة الاستجابة بفعالية. حلول تساعد على تحسين تجربة العملاء.',
  
  industriesTitle: 'خبرة في قطاعات متعددة',
  industriesLead: 'نفهم خصوصية كل قطاع ونوفر حلولاً تناسب متطلباته.',
  industriesGov: 'القطاع الحكومي',
  industriesGovDesc: 'حلول متوافقة مع متطلبات الأمان والشفافية والمتابعة الدقيقة للمشاريع الحكومية والخدمات العامة.',
  industriesFinance: 'القطاع المالي',
  industriesFinanceDesc: 'أدوات لإدارة العمليات المالية والتدقيق والامتثال، مع تركيز على الأمان والتوثيق الكامل لكل خطوة.',
  industriesHealth: 'القطاع الصحي',
  industriesHealthDesc: 'إدارة طلبات المرضى، مسارات العلاج، والتنسيق بين الأقسام بشكل آمن وفعال.',
  industriesEdu: 'القطاع التعليمي',
  industriesEduDesc: 'حلول لإدارة طلبات الطلاب، العمليات الإدارية، والتنسيق بين الأقسام الأكاديمية.',
  
  pricingTitle: 'أسعار واضحة ومرنة',
  pricingLead: 'اختر الباقة التي تناسب حجم فريقك واحتياجاتك. الدفع يحتاج إلى إعداد مزود خارجي.',
  pricingLoadError: 'تعذر تحميل الباقات من API. تحقق من إعداد خدمة الفوترة.',
  pricingNoteApi: 'الأسعار المعروضة أدناه ثابتة. عند إعداد واجهة الفوترة، ستُحمل الباقات والأسعار الحالية من API.',
  pricingNotePayment: 'الدفع الإلكتروني يحتاج إلى إعداد مزود دفع خارجي (Stripe أو PayPal). التفعيل يتطلب إعداد مفاتيح API والإعدادات.',
  pricingPerMonth: 'شهرياً',
  pricingSeats: 'مقاعد',
  pricingStorage: 'تخزين (GB)',
  pricingAi: 'أرصدة الذكاء الاصطناعي',
  
  templatesTitle: 'قوالب جاهزة للاستخدام',
  templatesLead: 'ابدأ بسرعة باستخدام قوالب مسارات عمل مصممة مسبقاً لسيناريوهات شائعة.',
  templatesAvailable: 'القوالب متوفرة ضمن مساحة العمل بعد إنشاء حسابك. يمكنك استيراد قوالب لطلبات الإجازات، الشكاوى، المشتريات، وسيناريوهات أخرى.',
  
  aboutTitle: 'من نحن',
  aboutLead: 'منصة عمانية لإدارة الأعمال والمشاريع، مصممة لتلبية احتياجات المؤسسات المحلية والإقليمية.',
  aboutMission: 'مهمتنا',
  aboutMissionDesc: 'توفير أدوات فعّالة لإدارة العمليات والمشاريع، مع التركيز على الأمان والخصوصية والامتثال للمعايير المحلية.',
  aboutVision: 'رؤيتنا',
  aboutVisionDesc: 'أن نكون المنصة الأولى للمؤسسات التي تبحث عن حلول إدارة أعمال موثوقة ومصممة محلياً.',
  aboutValues: 'قيمنا',
  aboutValuesDesc: 'الشفافية في التطوير، الأمان كأولوية، والاحترام الكامل لخصوصية بيانات عملائنا.',
  
  contactTitle: 'تواصل معنا',
  contactLead: 'نسعد بالإجابة على استفساراتك ومساعدتك في البدء بالمنصة.',
  contactName: 'الاسم الكامل',
  contactEmail: 'البريد الإلكتروني',
  contactMessage: 'رسالتك',
  contactSend: 'إرسال',
  contactSending: 'جارٍ الإرسال...',
  contactSuccess: 'تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.',
  contactError: 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.',
  contactRequired: 'هذا الحقل مطلوب',
  
  securityTitle: 'الأمان والحماية',
  securityLead: 'نأخذ أمان بياناتك على محمل الجد. هذه الصفحة مسودة أولية تحتاج إلى مراجعة قانونية قبل النشر الرسمي.',
  securityDraft: 'مسودة – تحتاج إلى مراجعة قانونية ومتخصص أمان قبل النشر للعملاء. لا توجد شهادات امتثال حالياً.',
  securityEncryption: 'التشفير',
  securityEncryptionDesc: 'جميع البيانات محمية بتشفير TLS أثناء النقل. البيانات الحساسة تُشفر في قاعدة البيانات.',
  securityAccess: 'التحكم بالوصول',
  securityAccessDesc: 'صلاحيات دقيقة على مستوى المؤسسة والمستخدم والصف. كل طلب يُصادق عليه ويُفحص الوصول قبل التنفيذ.',
  securityAudit: 'سجلات التدقيق',
  securityAuditDesc: 'جميع العمليات الحساسة تُسجل تلقائياً في سجل التدقيق لمتابعة الأنشطة والامتثال.',
  securityCompliance: 'الامتثال',
  securityComplianceDesc: 'هذه الصفحة مسودة توضح ضوابط المنصة. يلزم اعتماد سياسة الخصوصية والشروط ومراجعتها قانونيًا قبل الإطلاق الإنتاجي.',
  
  privacyTitle: 'سياسة الخصوصية',
  privacyLead: 'نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. هذه المسودة تحتاج إلى مراجعة قانونية نهائية.',
  privacyDraft: 'مسودة – تحتاج إلى مراجعة قانونية كاملة قبل النشر. يجب التوافق مع قانون حماية البيانات الشخصية العماني (PDPL).',
  privacyCollection: 'جمع البيانات',
  privacyCollectionDesc: 'نجمع فقط البيانات الضرورية لتقديم الخدمة: الاسم، البريد الإلكتروني، بيانات الاستخدام الأساسية.',
  privacyUsage: 'استخدام البيانات',
  privacyUsageDesc: 'تُستخدم البيانات لتشغيل المنصة وتقديم خدماتها. قد تُرسل البيانات اللازمة إلى مزودي الخدمات المهيئين؛ ويتطلب إرسال سياق العمل إلى مزود الذكاء الاصطناعي موافقة المؤسسة وإعداداته المعتمدة. راجع السياسة المعتمدة قبل الاستخدام الإنتاجي.',
  privacyRetention: 'الاحتفاظ بالبيانات',
  privacyRetentionDesc: 'نحتفظ ببياناتك طالما حسابك نشط. عند الحذف، تُمسح البيانات الشخصية بعد فترة قانونية محددة.',
  privacyRights: 'حقوقك',
  privacyRightsDesc: 'لك الحق في الوصول إلى بياناتك، تصحيحها، حذفها، أو طلب نسخة كاملة. تواصل معنا لممارسة حقوقك.',
  
  termsTitle: 'شروط الخدمة',
  termsLead: 'هذه الشروط تحكم استخدامك للمنصة. هذه المسودة تحتاج إلى مراجعة قانونية نهائية قبل النشر.',
  termsDraft: 'مسودة – تحتاج إلى مراجعة قانونية كاملة من مستشار قانوني قبل النشر الرسمي للعملاء.',
  termsAcceptance: 'قبول الشروط',
  termsAcceptanceDesc: 'باستخدامك للمنصة، فإنك توافق على هذه الشروط. إذا لم توافق، يجب عدم استخدام الخدمة.',
  termsService: 'الخدمة المقدمة',
  termsServiceDesc: 'نوفر منصة لإدارة الأعمال والمشاريع كخدمة سحابية. نبذل جهدنا لتوفير خدمة موثوقة لكن لا نضمن عدم الانقطاع.',
  termsLimitations: 'حدود المسؤولية',
  termsLimitationsDesc: 'نحن مسؤولون عن توفير الخدمة ولكن لسنا مسؤولين عن الأضرار غير المباشرة الناتجة عن استخدامك للمنصة.',
  termsTermination: 'إنهاء الخدمة',
  termsTerminationDesc: 'يمكنك إلغاء حسابك في أي وقت. نحتفظ بحق تعليق أو إنهاء الحساب في حال انتهاك الشروط.',
  
  helpTitle: 'المساعدة والدعم',
  helpLead: 'دليل مختصر للبدء باستخدام المنصة وفهم مميزاتها الأساسية.',
  helpGettingStarted: 'البداية',
  helpGettingStartedDesc: 'أنشئ حسابك، ادعُ فريقك، وابدأ بإنشاء أول مشروع أو مسار عمل. الواجهة مصممة لتكون بسيطة وسهلة الاستخدام.',
  helpWorkflows: 'مسارات العمل',
  helpWorkflowsDesc: 'صمم مسارات عمل مخصصة بمراحل متعددة، موافقات، وشروط. يمكنك إنشاء مسارات لأي عملية تشغيلية.',
  helpIntegrations: 'التكاملات',
  helpIntegrationsDesc: 'المنصة مصممة لتعمل بشكل مستقل، مع إمكانية التكامل مع خدمات خارجية عبر API. توثيق API متوفر للمطورين.',
  helpSupport: 'الدعم الفني',
  helpSupportDesc: 'تواصل معنا عبر نموذج الاتصال أو البريد الإلكتروني. نسعد بمساعدتك في أي استفسار.',
};

const en: MarketingContent = {
  features: 'Features',
  solutions: 'Solutions',
  industries: 'Industries',
  pricing: 'Pricing',
  templates: 'Templates',
  about: 'About',
  contact: 'Contact',
  security: 'Security',
  privacy: 'Privacy',
  terms: 'Terms',
  help: 'Help',
  login: 'Log in',
  register: 'Sign up',
  workspace: 'Workspace',
  getStarted: 'Get started',
  learnMore: 'Learn more',
  
  featuresTitle: 'Comprehensive features for your business',
  featuresLead: 'An all-in-one platform providing everything you need to manage projects and daily operations efficiently.',
  featuresWorkflows: 'Automated workflows',
  featuresWorkflowsDesc: 'Design custom workflows with visual tools, supporting conditions, multi-stage processes, and automated approvals. Every workflow adapts to your actual business needs.',
  featuresAi: 'Built-in AI',
  featuresAiDesc: 'Leverage intelligent suggestions for data completion, document summarization, and instant answers to your queries. AI features require external provider configuration.',
  featuresReports: 'Detailed reports',
  featuresReportsDesc: 'Customizable reports covering project progress, resource consumption, and financial indicators. Direct export in multiple formats for precise tracking.',
  featuresDocuments: 'Document management',
  featuresDocumentsDesc: 'Upload and share documents with instant preview support, permission control, and attachment linking to work requests and projects.',
  featuresFinance: 'Financial management',
  featuresFinanceDesc: 'Track expenses, create invoices, and monitor budgets within your workspace. Every financial operation is linked to projects and activities.',
  featuresMeetings: 'Meeting management',
  featuresMeetingsDesc: 'Schedule meetings, record minutes, and link decisions to actionable tasks. Every meeting has a complete record and follow-up decisions.',
  
  solutionsTitle: 'Solutions designed for your needs',
  solutionsLead: 'Whether you manage projects, operations, or teams, we provide the right tools.',
  solutionsOperations: 'Operations management',
  solutionsOperationsDesc: 'Automate internal requests, manage permissions, and track operational performance. Solutions built to improve daily efficiency.',
  solutionsProjects: 'Project management',
  solutionsProjectsDesc: 'Plan projects, distribute tasks, and track progress in real time. Tools that adapt to the size and complexity of your projects.',
  solutionsHr: 'Human resources',
  solutionsHrDesc: 'Manage leave, attendance, and employee requests through automated workflows. Simplify administrative processes for your team.',
  solutionsCustomer: 'Customer service',
  solutionsCustomerDesc: 'Receive requests, track cases, and manage responses effectively. Solutions that help improve customer experience.',
  
  industriesTitle: 'Expertise across multiple sectors',
  industriesLead: 'We understand the uniqueness of each sector and provide solutions tailored to its requirements.',
  industriesGov: 'Government sector',
  industriesGovDesc: 'Solutions compliant with security, transparency, and precise tracking requirements for government projects and public services.',
  industriesFinance: 'Financial sector',
  industriesFinanceDesc: 'Tools for managing financial operations, auditing, and compliance, with focus on security and complete documentation of every step.',
  industriesHealth: 'Healthcare sector',
  industriesHealthDesc: 'Manage patient requests, treatment workflows, and inter-department coordination securely and effectively.',
  industriesEdu: 'Education sector',
  industriesEduDesc: 'Solutions for managing student requests, administrative operations, and coordination between academic departments.',
  
  pricingTitle: 'Clear and flexible pricing',
  pricingLead: 'Choose the plan that fits your team size and needs. Payment requires external provider configuration.',
  pricingLoadError: 'Failed to load plans from API. Check billing service configuration.',
  pricingNoteApi: 'Prices shown below are static. When billing API is configured, current plans and prices will load from the API.',
  pricingNotePayment: 'Online payment requires external payment provider configuration (Stripe or PayPal). Activation requires API keys and settings.',
  pricingPerMonth: 'per month',
  pricingSeats: 'seats',
  pricingStorage: 'storage (GB)',
  pricingAi: 'AI credits',
  
  templatesTitle: 'Ready-to-use templates',
  templatesLead: 'Get started quickly with pre-designed workflow templates for common scenarios.',
  templatesAvailable: 'Templates are available within your workspace after creating your account. You can import templates for leave requests, complaints, purchases, and other scenarios.',
  
  aboutTitle: 'About us',
  aboutLead: 'An Omani platform for business and project management, designed to meet the needs of local and regional organizations.',
  aboutMission: 'Our mission',
  aboutMissionDesc: 'Provide effective tools for operations and project management, focusing on security, privacy, and compliance with local standards.',
  aboutVision: 'Our vision',
  aboutVisionDesc: 'To be the first choice for organizations seeking reliable, locally-designed business management solutions.',
  aboutValues: 'Our values',
  aboutValuesDesc: 'Transparency in development, security as a priority, and complete respect for our customers’ data privacy.',
  
  contactTitle: 'Contact us',
  contactLead: 'We’re happy to answer your questions and help you get started with the platform.',
  contactName: 'Full name',
  contactEmail: 'Email address',
  contactMessage: 'Your message',
  contactSend: 'Send',
  contactSending: 'Sending...',
  contactSuccess: 'Your message has been sent successfully. We will get back to you soon.',
  contactError: 'An error occurred while sending. Please try again.',
  contactRequired: 'This field is required',
  
  securityTitle: 'Security and protection',
  securityLead: 'We take your data security seriously. This page is a preliminary draft requiring legal review before official publication.',
  securityDraft: 'Draft – requires legal review and security expert review before customer publication. No compliance certifications currently held.',
  securityEncryption: 'Encryption',
  securityEncryptionDesc: 'All data is protected with TLS encryption in transit. Sensitive data is encrypted in the database.',
  securityAccess: 'Access control',
  securityAccessDesc: 'Precise permissions at organization, user, and row level. Every request is authenticated and access is verified before execution.',
  securityAudit: 'Audit logs',
  securityAuditDesc: 'All sensitive operations are automatically logged in the audit log for activity tracking and compliance.',
  securityCompliance: 'Compliance',
  securityComplianceDesc: 'This page is a draft describing platform controls. Privacy policies and terms require legal review and approval before production launch.',
  
  privacyTitle: 'Privacy policy',
  privacyLead: 'We respect your privacy and are committed to protecting your personal data. This draft requires final legal review.',
  privacyDraft: 'Draft – requires complete legal review before publication. Must comply with Oman’s Personal Data Protection Law (PDPL).',
  privacyCollection: 'Data collection',
  privacyCollectionDesc: 'We collect only data necessary to provide the service: name, email, basic usage data.',
  privacyUsage: 'Data usage',
  privacyUsageDesc: 'Data is used to operate the platform and deliver its services. Necessary data may be sent to configured service providers. Sending work context to an AI provider requires organization consent and approved settings. Review the approved policy before production use.',
  privacyRetention: 'Data retention',
  privacyRetentionDesc: 'We retain your data as long as your account is active. Upon deletion, personal data is erased after a specified legal period.',
  privacyRights: 'Your rights',
  privacyRightsDesc: 'You have the right to access your data, correct it, delete it, or request a complete copy. Contact us to exercise your rights.',
  
  termsTitle: 'Terms of service',
  termsLead: 'These terms govern your use of the platform. This draft requires final legal review before publication.',
  termsDraft: 'Draft – requires complete legal review by legal counsel before official customer publication.',
  termsAcceptance: 'Acceptance of terms',
  termsAcceptanceDesc: 'By using the platform, you agree to these terms. If you do not agree, you must not use the service.',
  termsService: 'Service provided',
  termsServiceDesc: 'We provide a business and project management platform as a cloud service. We strive to provide reliable service but do not guarantee uninterrupted access.',
  termsLimitations: 'Limitations of liability',
  termsLimitationsDesc: 'We are responsible for providing the service but are not liable for indirect damages resulting from your use of the platform.',
  termsTermination: 'Service termination',
  termsTerminationDesc: 'You can cancel your account at any time. We reserve the right to suspend or terminate the account in case of terms violation.',
  
  helpTitle: 'Help and support',
  helpLead: 'A brief guide to get started with the platform and understand its core features.',
  helpGettingStarted: 'Getting started',
  helpGettingStartedDesc: 'Create your account, invite your team, and start creating your first project or workflow. The interface is designed to be simple and user-friendly.',
  helpWorkflows: 'Workflows',
  helpWorkflowsDesc: 'Design custom workflows with multiple stages, approvals, and conditions. You can create workflows for any operational process.',
  helpIntegrations: 'Integrations',
  helpIntegrationsDesc: 'The platform is designed to work independently, with the ability to integrate with external services via API. API documentation is available for developers.',
  helpSupport: 'Technical support',
  helpSupportDesc: 'Contact us via the contact form or email. We’re happy to help with any inquiry.',
};

export const marketing = { ar, en };
export function marketingDictionary(locale: Locale): MarketingContent {
  return marketing[locale];
}

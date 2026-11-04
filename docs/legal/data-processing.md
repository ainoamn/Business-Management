# Data Processing Agreement (DPA)

**Effective Date:** [DATE]

This Data Processing Agreement ("DPA") forms part of the Terms of Service between:

**Data Controller:** The Organization using the Service (the "Customer")  
**Data Processor:** [COMPANY/ORGANIZATION NAME] (the "Processor" or "we")

---

## 1. Definitions

- **Personal Data:** Information relating to an identified or identifiable natural person
- **Processing:** Any operation performed on Personal Data (e.g., collection, storage, use, deletion)
- **Data Subject:** The individual whose Personal Data is processed
- **GDPR:** General Data Protection Regulation (EU) 2016/679
- **Service:** Work Management System as defined in the Terms of Service

---

## 2. Scope and Purpose

### 2.1 Role of Parties
- **Customer** is the Data Controller who determines the purposes and means of Processing Personal Data
- **Processor** processes Personal Data on behalf of Customer to provide the Service

### 2.2 Processing Activities
Processor processes Personal Data for the following purposes:
- Providing the work management platform
- Storing and displaying user-generated content
- Sending notifications and communications
- Providing technical support
- (Optional) AI-powered assistance features

---

## 3. Customer's Obligations

Customer warrants that:
- It has a lawful basis for Processing Personal Data under GDPR
- It has obtained necessary consents from Data Subjects
- Instructions to Processor comply with applicable data protection laws
- It will respond to Data Subject requests (access, deletion, etc.)

---

## 4. Processor's Obligations

### 4.1 Lawful Processing
Processor will:
- Process Personal Data only on documented instructions from Customer
- Not process Personal Data for any other purpose
- Ensure personnel are bound by confidentiality obligations

### 4.2 Security Measures
Processor implements technical and organizational measures including:
- Encryption in transit (TLS 1.3) and at rest (AES-256)
- Access controls and authentication (MFA for admins)
- Regular security audits and vulnerability scanning
- Malware scanning for uploaded files (ClamAV)
- Intrusion detection and monitoring
- Secure data center facilities (per subprocessor standards)

### 4.3 Data Subject Rights
Processor will assist Customer in responding to Data Subject requests:
- **Access:** Provide data export functionality
- **Rectification:** Allow Customer to update inaccurate data
- **Erasure:** Permanently delete data upon Customer request (per retention policy)
- **Portability:** Export data in machine-readable format (JSON, CSV)
- **Objection:** Disable optional features (e.g., AI) upon request

### 4.4 Data Breach Notification
- Processor will notify Customer of a Personal Data breach within **72 hours** of discovery
- Notification includes:
  - Nature of the breach
  - Categories and approximate number of Data Subjects affected
  - Likely consequences
  - Measures taken or proposed to mitigate

---

## 5. Subprocessors

### 5.1 Authorized Subprocessors
Processor engages the following subprocessors:

| Subprocessor | Purpose | Location | Safeguards |
|--------------|---------|----------|------------|
| [Hosting Provider] | Infrastructure hosting | [Region] | Standard Contractual Clauses |
| [Email Service] | Email delivery | [Region] | GDPR-compliant DPA |
| [AI Provider] | (Optional) AI features | [Region] | Customer consent required |

### 5.2 Changes to Subprocessors
- Processor will notify Customer of new subprocessors at least **30 days** in advance
- Customer may object if subprocessor does not meet GDPR requirements
- If objection cannot be resolved, Customer may terminate the Service

---

## 6. International Data Transfers

### 6.1 Transfers Outside EEA
If Personal Data is transferred outside the European Economic Area:
- Processor implements **Standard Contractual Clauses** (SCCs) approved by the European Commission
- Processor conducts a **Transfer Impact Assessment** to ensure adequate protections
- Supplementary measures applied as necessary (e.g., encryption, pseudonymization)

### 6.2 Customer Consent
By using the Service, Customer consents to such transfers subject to safeguards above.

---

## 7. Data Retention and Deletion

### 7.1 Retention Period
- **Active Accounts:** Data retained as long as the account is active
- **Deleted Accounts:** Data soft-deleted immediately; permanently deleted after **90 days**
- **Backups:** Deleted data may persist in encrypted backups for up to **30 days**

### 7.2 Data Return and Deletion
Upon termination or Customer request:
- Processor provides data export in machine-readable format
- Processor permanently deletes all Personal Data within **90 days** (except as required by law)
- Certificate of deletion provided upon request

---

## 8. Audit and Inspection Rights

### 8.1 Audit Reports
- Processor provides annual SOC 2 Type II or ISO 27001 certification (if available)
- Processor provides security questionnaire responses upon request

### 8.2 On-Site Audits
- Customer may audit Processor's compliance once per year with 30 days' notice
- Audits conducted during business hours at Customer's expense
- Audit scope limited to Processing activities relevant to Customer's data

---

## 9. Confidentiality

Both parties agree:
- Personal Data is confidential and protected from unauthorized disclosure
- Personnel access Personal Data only as necessary for job duties
- Confidentiality obligations survive termination

---

## 10. Liability and Indemnification

### 10.1 Liability
- Each party is liable for damages caused by breach of this DPA
- Processor liable for subprocessor failures as if Processor's own

### 10.2 Limitation
- Liability subject to limits in the Terms of Service
- Excludes liability for force majeure events

---

## 11. Term and Termination

### 11.1 Term
- This DPA is effective upon Service activation and continues until termination

### 11.2 Termination
- Customer may terminate upon 30 days' notice if Processor breaches this DPA
- Processor may terminate if continued Processing violates applicable law
- Data deleted per Section 7 upon termination

---

## 12. Governing Law and Jurisdiction

- Governed by the laws of [JURISDICTION]
- Disputes resolved in courts of [JURISDICTION]
- GDPR provisions prevail in case of conflict

---

## 13. Amendments

- Processor may update this DPA to reflect legal changes
- Material changes notified via email with 30 days' notice
- Continued use after changes constitutes acceptance

---

## 14. Contact for Data Protection Matters

**Data Protection Officer (if applicable):**  
**Email:** [DPO EMAIL]  
**Mail:** [PHYSICAL ADDRESS]

**General Inquiries:**  
**Email:** [SUPPORT EMAIL]

---

## Appendix A: Categories of Data and Data Subjects

### Categories of Data Subjects
- Organization administrators
- Organization members (employees, contractors)
- Invited users (pending acceptance)

### Categories of Personal Data
- **Identity Data:** Name, email, username
- **Account Data:** Password hash, MFA secret (encrypted)
- **Profile Data:** Job title, department, role
- **User Content:** Tasks, projects, comments, documents
- **Technical Data:** IP address, browser type, session logs
- **Communication Data:** Email notifications, in-app messages

### Special Categories (if applicable)
- None (unless Customer uploads sensitive data, which is discouraged)

---

## Appendix B: Technical and Organizational Measures

| Measure | Description |
|---------|-------------|
| **Encryption** | TLS 1.3 in transit; AES-256 at rest |
| **Access Control** | Role-based permissions; MFA for admins |
| **Logging** | Audit logs retained for 12 months |
| **Backup** | Daily encrypted backups; 30-day retention |
| **Malware Scanning** | ClamAV for uploaded files |
| **Incident Response** | 24/7 monitoring; breach notification within 72h |
| **Data Minimization** | Only collect data necessary for Service |
| **Pseudonymization** | User IDs are UUIDs; no direct identifiers in logs |

---

**Acknowledgment:** By using the Service, Customer acknowledges and agrees to the terms of this Data Processing Agreement.

# DocApply – Application Portal for Doctoral Candidates

**DocApply** is a modern, inclusive, and efficient application portal for doctoral positions at the Technical University
of Munich. It streamlines application management, improves usability for applicants and research groups, and supports
scalable, secure, and transparent recruitment processes.

## Who is this for?

- **Applicants**: Search and apply for open doctoral positions across all TUM research groups.
- **Professors and Research Groups**: Create job positions, review applications, and manage evaluations in one place.

## What can you do on DocApply?

### For Applicants

- Browse doctoral openings across TUM
- View job details and requirements
- Apply with your documents (CV, transcripts, motivation letter, etc.)
- Save, submit and delete application drafts
- Track/Review your application details and submission for multiple positions
- Withdraw applications
- Get notified when a decision is made

### For Professors & Research Groups

- Create and publish doctoral positions
- View published positions
- View position details
- Edit jobs
- Close and delete job postings
- Manage incoming applications
- Evaluate candidates and assign status
- Notify applicants directly via the system

## How to Get Started

1. Visit the portal: [DocApply](https://docapply.aet.cit.tum.de/)
2. Browse available doctoral positions
3. Register/Log in with your preferred account
4. Start applying or managing applications

## Registration

New users can register directly on the DocApply portal using their email address or social login options.

## Login

DocApply supports **secure login** via:

- TUM Single Sign-On (SSO)
- Apple and Google
- Email and code
- Email and password

## Architecture Overview

DocApply is designed with modularity, scalability, and maintainability in mind. While it follows a monolithic
architecture for now, clear service boundaries allow for potential migration to microservices in the future.

### Technology Stack

| Component      | Technology                         |
| -------------- | ---------------------------------- |
| Client         | Angular                            |
| Server         | Spring Boot (Java)                 |
| Proxy          | Nginx                              |
| Database       | MySQL with Hibernate               |
| Authentication | Keycloak (with Google / Apple SSO) |
| Deployment     | GitHub + GitHub Actions (CI/CD)    |

### Core Modules & Responsibilities

| Module/Service         | Responsibilities                                     |
| ---------------------- | ---------------------------------------------------- |
| User Authentication    | Handles logins via Keycloak                          |
| Job Management         | Professors create and manage doctoral positions      |
| Application Handling   | Applicants submit documents for a position           |
| Evaluation System      | Professors review, rate, and comment on applications |
| User Management System | Manage users, roles, and permissions                 |
| Notification System    | Sends automated status updates via email             |

### Areas of Work

| Area                      | Tasks                                                       |
| ------------------------- | ----------------------------------------------------------- |
| Client-Side               | Angular UI development with role-based views                |
| Server-Side               | Implement REST APIs using Spring Boot                       |
| Database Management       | Design and optimize MySQL schema                            |
| Authentication & Security | Keycloak integration for user and role handling             |
| Proxy & Load Balancing    | Nginx setup for secure request routing                      |
| CI/CD Pipeline            | Automated builds, tests, and deployments via GitHub Actions |

## Documentation

Full documentation is available on the [DocApply Docs](https://ls1intum.github.io/doc-apply/) site.

---

© 2026 Technische Universität München – Built with ❤️ by the DocApply Team at [Applied Education
Technologies (AET)](https://aet.cit.tum.de/)

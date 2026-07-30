import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const sections = [
  {
    title: 'Applicants',
    icon: '🎓',
    description: 'Account creation, job search, applications, and dashboard.',
    link: '/applicants/account-creation',
  },
  {
    title: 'Professors / Employees',
    icon: '👩‍🏫',
    description: 'Research groups, job postings, application review, and interviews.',
    link: '/professors/account-creation',
  },
  {
    title: 'Developers',
    icon: '💻',
    description: 'Setup, architecture, and contribution guidelines.',
    link: '/developer/category/developers',
  },
  {
    title: 'Admins',
    icon: '🔧',
    description: 'Platform administration, user management, and configuration.',
    link: '/admin/category/admins',
  },
];

function Tile({title, icon, description, link}: (typeof sections)[number]) {
  return (
    <Link to={link} className={styles.tile}>
      <div className={styles.tileIcon}>{icon}</div>
      <h3 className={styles.tileTitle}>{title}</h3>
      <p className={styles.tileDescription}>{description}</p>
    </Link>
  );
}

const faqItems = [
  {
    question: 'Do I need an account to browse positions?',
    answer: (
      <>
        No. You can search and view all open positions on DocApply without creating an account.
        <br />
        If you want to apply for a position or save your personal data, you need to create an account.
      </>
    ),
  },
  {
    question: 'How do I create an account?',
    answer:
      'Applicants can register with Google, Apple, or email. Professors automatically get an account when they log in with their TUM ID.',
  },
  {
    question: 'How do I log in?',
    answer: (
      <>
        <strong>Applicants:</strong> Go to <a href="https://docapply.aet.cit.tum.de/">DocApply</a> and click <strong>Login</strong> in the
        top-right corner. Choose email + verification code, Google, or Apple.
        <br />
        <br />
        <strong>Professors:</strong> Go to <a href="https://docapply.aet.cit.tum.de/professor">DocApply Professor</a> and click{' '}
        <strong>Login</strong>. Sign in with your TUM ID and password. No separate registration is required.
      </>
    ),
  },
  {
    question: 'I did not receive my email code. What can I do?',
    answer: 'First, check your spam folder. If no code arrived, request a new one in the login dialog.',
  },
  {
    question: 'What are Research Groups?',
    answer:
      'Research Groups are usually equivalent to chairs and professorships at TUM. They are needed for professors to manage applications and postings.',
  },
  {
    question: "I am a professor and don't see my professor rights. What should I do?",
    answer:
      'On first login, you only have applicant rights. Please send us an email with the name of your Research Group and its head. Our team will assign your rights and confirm by email.',
  },
  {
    question: 'Can I apply without an account?',
    answer:
      'No. You can browse all open positions without an account, but as soon as you want to apply, you must create an account.',
  },
];

function FAQSection() {
  return (
    <section className={styles.faqSection}>
      <h2 className={styles.faqHeading}>Frequently Asked Questions</h2>
      <p className={styles.faqSubtext}>
        Quick answers to the most common questions. For more detail, check the relevant documentation section.
      </p>
      <div className={styles.faqList}>
        {faqItems.map((item, i) => (
          <details key={i} className={styles.faqItem}>
            <summary className={styles.faqSummary}>
              <span>{item.question}</span>
              <span className={styles.faqChevron} aria-hidden="true" />
            </summary>
            <div className={styles.faqAnswer}>{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          Welcome to the DocApply User Documentation
        </Heading>
        <p className="hero__subtitle">The official guide for Applicants, Professors, Developers, and Admins using DocApply.</p>
        <div className={styles.tileGrid}>
          {sections.map((section) => (
            <Tile key={section.title} title={section.title} icon={section.icon} description={section.description} link={section.link} />
          ))}
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout title={`DocApply Documentation`} description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <FAQSection />
    </Layout>
  );
}

import { notFound } from 'next/navigation';
import { isRegistrationId } from '../../../lib/playerRegistration.js';
import { RegistrationTablet } from '../../../components/registration/RegistrationTablet.jsx';
import './registration.css';

export async function generateMetadata({ params }) {
  const { code } = await params;
  return {
    title: 'Spillertilmelding | Showdart',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    manifest: isRegistrationId(code) ? `/tilmelding/${code}/manifest.webmanifest` : null
  };
}

export default async function RegistrationPage({ params }) {
  const { code } = await params;
  if (!isRegistrationId(code)) notFound();
  return <RegistrationTablet code={code} />;
}

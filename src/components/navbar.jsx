import Link from "next/link";

import styles from './navbar.module.css'

export default function Navbar() {
  return (
    <nav>
      <ul>
        <li><Link href="/">App</Link></li>
        <li><Link href="/Home">Home</Link></li>
      </ul>
    </nav>
  );
}

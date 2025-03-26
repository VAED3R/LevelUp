import Navbar from "@/components/navbar";
export default function Home() {
    return (
      <div className={styles.page}>
              <Navbar />
        <h1>This is Home</h1>
      </div>
    );
  }
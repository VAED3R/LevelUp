export default function teachauth() {
  return (
    <div>
      <h1>Teacher Login</h1>
    <label for="email">Email:</label>
    <input type="email" id="email" name="email" required />
    <br />
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" required />
    <br />
    <input type="submit" value="Submit" />
    </div>
  );
}
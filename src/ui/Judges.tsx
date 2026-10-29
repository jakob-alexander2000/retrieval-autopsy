export function Judges() {
  return (
    <section className="judges" aria-labelledby="judges-heading">
      <h2 id="judges-heading">How it judges</h2>
      <p>Read the sentence. Then read that sentence against the passage it came from.</p>
      <dl>
        <div>
          <dt>Support</dt>
          <dd>Each sentence has to be made of words that are in a passage the search returned.</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>If the handbook says who it is for, the answer cannot widen that to everyone.</dd>
        </div>
        <div>
          <dt>Qualifier</dt>
          <dd>Words such as only and after, and the numbers, have to stay in the answer.</dd>
        </div>
        <div>
          <dt>Omission</dt>
          <dd>An unless, an except, or a “not eligible” that would change the result has to stay too.</dd>
        </div>
      </dl>
      <p>A failed check marks the exact words.</p>
    </section>
  );
}

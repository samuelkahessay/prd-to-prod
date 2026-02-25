import app, { snippetStore } from './app';
import { seedSnippets } from './seed';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

seedSnippets(snippetStore);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

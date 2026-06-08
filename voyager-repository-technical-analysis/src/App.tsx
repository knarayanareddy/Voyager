import { DatabaseProvider } from './context/DatabaseContext';
import LogseqApp from './components/LogseqApp';

export default function App() {
  return (
    <DatabaseProvider>
      <LogseqApp />
    </DatabaseProvider>
  );
}

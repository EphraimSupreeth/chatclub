import { useEffect, useState } from 'react';
import './App.css';
import { classroom, currentUser, conversations, messages } from './data/demoData';
import { isSupabaseConfigured } from './lib/supabase';
import { getSession, onAuthStateChange } from './services/chatclubApi';
import AuthScreen from './components/AuthScreen';
import AuthenticatedApp from './components/AuthenticatedApp';
import ClassroomSidebar from './components/ClassroomSidebar';
import ChatPanel from './components/ChatPanel';
import CommunityPanel from './components/CommunityPanel';
import JoinScreen from './components/JoinScreen';
import SetupScreen from './components/SetupScreen';

function DemoApp() {
  const [hasEntered, setHasEntered] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [activeConversationId, setActiveConversationId] = useState(conversations[0].id);

  if (!hasEntered) return <JoinScreen onEnter={() => setHasEntered(true)} />;

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0];

  return (
    <main className="app-shell">
      <ClassroomSidebar
        classroom={classroom}
        currentUser={currentUser}
        activeView={activeView}
        onSelectView={setActiveView}
        onLeave={() => setHasEntered(false)}
      />
      {activeView === 'chat' ? (
        <ChatPanel
          classroom={classroom}
          currentUser={currentUser}
          conversations={conversations}
          activeConversation={activeConversation}
          messages={messages[activeConversation.id] ?? []}
          onSelectConversation={setActiveConversationId}
        />
      ) : (
        <CommunityPanel view={activeView} classroom={classroom} />
      )}
    </main>
  );
}

function ConnectedApp() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    getSession()
      .then(({ session: currentSession }) => setSession(currentSession))
      .catch(() => setSession(null));
    const { data } = onAuthStateChange(setSession);
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <main className="loading-page"><p>Opening ChatClub…</p></main>;
  }

  return session ? <AuthenticatedApp user={session.user} /> : <AuthScreen />;
}

function App() {
  const [showDemo, setShowDemo] = useState(false);

  if (!isSupabaseConfigured && !showDemo) {
    return <SetupScreen onViewDemo={() => setShowDemo(true)} />;
  }

  return isSupabaseConfigured ? <ConnectedApp /> : <DemoApp />;
}

export default App;

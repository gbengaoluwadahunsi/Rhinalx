import { Route, Routes } from 'react-router-dom'
import { AppShell, LandingLayout } from './shell'
import { AnswerScreen, AskScreen } from './screens/ask'
import { HomeScreen } from './screens/home'
import { IngestScreen, ProcessingScreen, ReviewScreen } from './screens/ingest'
import { ArchiveScreen, KnowledgeScreen } from './screens/knowledge'
import {
  HowItWorksScreen,
  LandingScreen,
  ScienceScreen,
  SecurityScreen,
  UseCasesScreen,
} from './screens/marketing'
import { MemoryMapScreen, SearchScreen } from './screens/misc'
import { CreateStudyScreen, ModelCheckScreen, WelcomeScreen } from './screens/onboarding'
import { PrecedentScreen } from './screens/precedent'
import { QuestionsScreen } from './screens/questions'
import { SettingsScreen, StudiesScreen } from './screens/settings'
import { SourcesScreen, SourceViewerScreen } from './screens/sources'
import { DecisionDetailScreen, TimelineScreen } from './screens/timeline'

export default function App() {
  return (
    <Routes>
      {/* Public / marketing */}
      <Route element={<LandingLayout />}>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/how-it-works" element={<HowItWorksScreen />} />
        <Route path="/security" element={<SecurityScreen />} />
        <Route path="/science" element={<ScienceScreen />} />
        <Route path="/use-cases" element={<UseCasesScreen />} />
      </Route>

      {/* Onboarding (full-screen) */}
      <Route path="/welcome" element={<WelcomeScreen />} />
      <Route path="/setup/models" element={<ModelCheckScreen />} />
      <Route path="/setup/study" element={<CreateStudyScreen />} />

      {/* App workspace */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="ask" element={<AskScreen />} />
        <Route path="answer" element={<AnswerScreen />} />
        <Route path="questions" element={<QuestionsScreen />} />
        <Route path="timeline" element={<TimelineScreen />} />
        <Route path="timeline/:id" element={<DecisionDetailScreen />} />
        <Route path="precedent" element={<PrecedentScreen />} />
        <Route path="knowledge" element={<KnowledgeScreen />} />
        <Route path="archive" element={<ArchiveScreen />} />
        <Route path="sources" element={<SourcesScreen />} />
        <Route path="sources/:id" element={<SourceViewerScreen />} />
        <Route path="search" element={<SearchScreen />} />
        <Route path="map" element={<MemoryMapScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="studies" element={<StudiesScreen />} />
        <Route path="ingest" element={<IngestScreen />} />
        <Route path="ingest/processing" element={<ProcessingScreen />} />
        <Route path="ingest/review" element={<ReviewScreen />} />
      </Route>
    </Routes>
  )
}

import React, { useState } from 'react';
import type { ProjectMeta } from './projectTypes';
import ProjectsHome from './components/ProjectsHome';
import ProjectHome from './components/ProjectHome';
import DesignApp from './design/DesignApp';
import CardsApp from './cards/CardsApp';
import GameApp from './game/GameApp';

type Screen = 'projects' | 'project' | 'design' | 'cards' | 'game';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('projects');
  const [currentProject, setCurrentProject] = useState<ProjectMeta | null>(null);

  const openProject = (project: ProjectMeta) => {
    setCurrentProject(project);
    setScreen('project');
  };

  const backToProjects = () => {
    setScreen('projects');
    setCurrentProject(null);
  };

  const backToProject = () => setScreen('project');

  if (screen === 'projects' || !currentProject) {
    return <ProjectsHome onOpenProject={openProject} />;
  }

  if (screen === 'project') {
    return (
      <ProjectHome
        project={currentProject}
        onOpenModule={id => setScreen(id)}
        onBackToProjects={backToProjects}
      />
    );
  }

  if (screen === 'design') {
    return (
      <DesignApp
        projectId={currentProject.id}
        projectName={currentProject.name}
        onBackToLauncher={backToProject}
      />
    );
  }

  if (screen === 'cards') {
    return (
      <CardsApp
        projectId={currentProject.id}
        projectName={currentProject.name}
        onBackToLauncher={backToProject}
      />
    );
  }

  return <GameApp onBackToLauncher={backToProject} projectName={currentProject.name} />;
};

export default App;

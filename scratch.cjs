const fs = require('fs');

const files = [
  'src/features/planner/pages/ChildPlannerV2Page.tsx',
  'src/features/planner/services/planner.firestore.ts',
  'src/hooks/useData.ts',
  'src/hooks/useRoutines.ts',
  'src/hooks/useTaskScheduler.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('getTelegramApiUrl')) {
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    
    let depth = file.split('/').length - 2;
    if (file.includes('features/planner/pages') || file.includes('features/planner/services')) {
      depth = 4;
    }
    const relativePrefix = depth === 1 ? '../' : depth === 2 ? '../../' : depth === 3 ? '../../../' : depth === 4 ? '../../../../' : './';
    const importStmt = `\nimport { getTelegramApiUrl } from '${relativePrefix}utils/telegram';`;
    
    content = content.slice(0, endOfLastImport) + importStmt + content.slice(endOfLastImport);
    content = content.replace(/fetch\('(\/api\/telegram\/[^']+)'/g, "fetch(getTelegramApiUrl('$1')");
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});

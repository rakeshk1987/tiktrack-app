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
    // Add import statement at top, just below existing imports
    // Find last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    
    // Some files might use relative paths, we can use absolute or aliased? 
    // Let's use relative for now based on file depth.
    const depth = file.split('/').length - 2;
    const relativePrefix = depth === 0 ? './' : '../'.repeat(depth);
    const importStmt = `\nimport { getTelegramApiUrl } from '${relativePrefix}utils/telegram';`;
    
    content = content.slice(0, endOfLastImport) + importStmt + content.slice(endOfLastImport);
    
    // Replace fetch('/api/telegram/...
    content = content.replace(/fetch\('(\/api\/telegram\/[^']+)'/g, "fetch(getTelegramApiUrl('$1')");
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});

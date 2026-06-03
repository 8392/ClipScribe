const api = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: `${import.meta.dir}/../apps/api`,
  stdout: 'inherit',
  stderr: 'inherit',
})
const web = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: `${import.meta.dir}/../apps/web`,
  stdout: 'inherit',
  stderr: 'inherit',
})

process.on('SIGINT', () => {
  api.kill()
  web.kill()
  process.exit(0)
})

await Promise.all([api.exited, web.exited])

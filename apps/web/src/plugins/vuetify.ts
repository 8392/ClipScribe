import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'clipscribeDark',
    themes: {
      clipscribeDark: {
        dark: true,
        colors: {
          background: '#0f1419',
          surface: '#1a2332',
          primary: '#5b9fd4',
          secondary: '#8b9cb3',
          error: '#e57373',
          success: '#81c784',
        },
      },
    },
  },
})

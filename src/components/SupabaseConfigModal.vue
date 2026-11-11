<script setup>
import { ref, watch } from 'vue'
import { useFlvStore } from '../stores/useFlvStore'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])
const store = useFlvStore()

const urlInput = ref('')
const keyInput = ref('')
const emailInput = ref('')
const passwordInput = ref('')
const authError = ref('')
const isLoading = ref(false)

watch(
  () => props.show,
  (val) => {
    if (val) {
      const saved = store.getSavedSupabaseConfig()
      urlInput.value = saved.url
      keyInput.value = saved.anonKey
      authError.value = ''
      passwordInput.value = ''
    }
  },
  { immediate: true }
)

async function handleSaveConfig() {
  await store.configureSupabase(urlInput.value, keyInput.value)
}

async function handleLogin() {
  authError.value = ''
  if (!urlInput.value.trim() || !keyInput.value.trim()) {
    authError.value = 'Informe primeiro a Project URL e a Publishable Key.'
    return
  }
  if (!emailInput.value.trim() || !passwordInput.value) {
    authError.value = 'Informe e-mail e senha de um usuário autenticado no Supabase Auth.'
    return
  }

  isLoading.value = true
  try {
    await store.configureSupabase(urlInput.value, keyInput.value)
    const res = await store.loginSupabase(emailInput.value, passwordInput.value)
    if (!res.ok) {
      authError.value = res.error
    } else {
      passwordInput.value = ''
      emit('close')
    }
  } finally {
    isLoading.value = false
  }
}

async function handleLogout() {
  await store.logoutSupabase()
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-on-background/50 backdrop-blur-xs p-4"
  >
    <div
      class="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/30"
    >
      <!-- Cabeçalho -->
      <div class="flex items-center justify-between px-5 py-4 bg-primary text-on-primary">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]">verified_user</span>
          <div>
            <h3 class="font-headline-sm text-headline-sm leading-tight">
              Segurança & Nuvem Supabase
            </h3>
            <p class="font-label-sm text-label-sm text-on-primary/80">
              Acesso exclusivo para usuários autenticados (RLS Force)
            </p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-on-primary/15 transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div class="p-5 space-y-4">
        <!-- Aviso de Segurança Zero-Anon -->
        <div class="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
          <span class="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
            lock
          </span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Nenhuma chave é salva no GitHub e <strong>nenhuma permissão anônima (`anon`)</strong> é
            permitida no banco. As consultas exigem sessão autenticada (`authenticated`).
          </p>
        </div>

        <!-- Endpoint local -->
        <div class="space-y-3">
          <div>
            <label class="block font-label-md text-label-md text-on-surface mb-1">
              Project URL (Salvo apenas neste dispositivo)
            </label>
            <input
              v-model="urlInput"
              type="url"
              placeholder="https://seu-projeto.supabase.co"
              class="w-full h-11 px-3.5 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block font-label-md text-label-md text-on-surface mb-1">
              Publishable Key (`sb_publishable_...`)
            </label>
            <input
              v-model="keyInput"
              type="password"
              autocomplete="off"
              placeholder="sb_publishable_..."
              class="w-full h-11 px-3.5 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <!-- Sessão Autenticada -->
        <div v-if="store.authUser" class="p-3.5 rounded-xl bg-primary-fixed/40 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-primary-fixed truncate">
                  Autenticado: {{ store.authUser.email }}
                </p>
                <p class="font-body-sm text-body-sm text-on-primary-fixed-variant">
                  JWT verificado via Supabase Auth
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="handleLogout"
              class="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-sm text-label-sm shrink-0"
            >
              Sair
            </button>
          </div>
        </div>

        <!-- Formulário de Login Supabase Auth -->
        <div v-else class="pt-2 border-t border-outline-variant/25 space-y-3">
          <span class="block font-label-lg text-label-lg text-on-surface">
            Login de Usuário Autenticado (Supabase Auth)
          </span>

          <input
            v-model="emailInput"
            type="email"
            placeholder="E-mail cadastrado no Supabase Auth"
            class="w-full h-11 px-3.5 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <input
            v-model="passwordInput"
            type="password"
            placeholder="Senha do usuário"
            class="w-full h-11 px-3.5 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <p v-if="authError" class="font-label-md text-label-md text-error">
            {{ authError }}
          </p>

          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              @click="handleSaveConfig"
              class="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors"
            >
              Salvar Endpoint
            </button>
            <button
              type="button"
              :disabled="isLoading"
              @click="handleLogin"
              class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>{{ isLoading ? 'Verificando...' : 'Entrar Seguro' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

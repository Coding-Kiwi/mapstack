<template>
  <div class="min-h-screen bg-gray-900 text-gray-200">
    <!-- HEADER -->
    <header class="bg-gray-800 border-b border-gray-700 p-6 shadow-md">
      <h1 class="text-4xl font-bold text-gray-100 text-center">Mapstack Dashboard</h1>
    </header>

    <main class="p-6 space-y-6">

      <!-- NOTIFICATION -->
      <transition name="fade">
        <div
          v-if="notification.message"
          :class="notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'"
          class="text-white px-4 py-3 rounded-md shadow-md max-w-xl mx-auto text-center"
        >
          {{ notification.message }}
        </div>
      </transition>

      <!-- STATUS CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div
          v-for="svcKey in serviceKeys"
          :key="svcKey"
          class="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col items-center space-y-2"
        >
          <!-- Status Icon -->
          <div class="w-14 h-14 flex items-center justify-center rounded-full"
            :class="{
              'bg-green-600': services[svcKey].status === 'online',
              'bg-gray-600': services[svcKey].status === 'offline',
              'bg-yellow-500': services[svcKey].status === 'starting'
            }"
          >
            <template v-if="services[svcKey].status === 'online'">
              <span class="text-white text-xl font-bold">✓</span>
            </template>
            <template v-else-if="services[svcKey].status === 'offline'">
              <span class="text-gray-300 text-xl font-bold">⛔</span>
            </template>
            <template v-else-if="services[svcKey].status === 'starting'">
              <svg class="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </template>
          </div>

          <!-- Service Name -->
          <div class="text-lg font-semibold text-gray-100 capitalize">
            {{ svcKey }}
          </div>

          <!-- Status Text -->
          <div class="text-sm text-gray-300">
            Status:
            <span
              :class="{
                'text-green-400': services[svcKey].status === 'online',
                'text-gray-400': services[svcKey].status === 'offline',
                'text-yellow-400': services[svcKey].status === 'starting'
              }"
            >
              {{ services[svcKey].status }}
            </span>
          </div>

          <!-- Disk Usage -->
          <div v-if="services[svcKey].disk_usage" class="text-sm text-gray-400">
            Disk Usage: {{ services[svcKey].disk_usage }}
          </div>
        </div>
      </div>

      <!-- COUNTRY SEARCH SELECT -->
      <div class="relative max-w-md mx-auto">
        <label class="block text-sm font-medium text-gray-300 mb-2">Select Country</label>
        <input
          v-model="countryQuery"
          @focus="showDropdown = true"
          type="text"
          placeholder="Search countries..."
          class="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-600"
        />
        <ul
          v-if="showDropdown && filteredList.length"
          class="absolute left-0 right-0 bg-gray-800 border border-gray-700 rounded-md mt-1 max-h-48 overflow-auto z-20"
        >
          <li
            v-for="ctr in filteredList"
            :key="ctr.code"
            @click="selectCountry(ctr)"
            class="px-4 py-2 cursor-pointer hover:bg-gray-700 text-gray-200"
          >
            {{ ctr.name }}
          </li>
        </ul>
      </div>

      <!-- SELECTED COUNTRY DISPLAY -->
      <div v-if="selectedCountryObj" class="text-center text-lg font-semibold text-gray-300">
        Selected: <span class="text-indigo-300">{{ selectedCountryObj.name }}</span>
      </div>

      <!-- DEPLOY BUTTON -->
      <div class="text-center">
        <button
          @click="deploy"
          :disabled="!selectedCountryObj || deploying"
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 transition"
        >
          {{ deploying ? "Deploying..." : "Deploy" }}
        </button>
      </div>

      <!-- FOOTER -->
      <footer class="text-center text-sm text-gray-500 pt-4">
        Last status update: {{ lastUpdated }}
      </footer>
    </main>
  </div>
</template>

<script setup>
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';

// Initialize services so grid renders immediately
const services = ref({
  photon: { status: 'unknown', disk_usage: null },
  versatiles: { status: 'unknown', disk_usage: null },
  graphhopper: { status: 'unknown', disk_usage: null },
});

// Computed property for safe iteration
const serviceKeys = computed(() => Object.keys(services.value || {}));

const countryList = ref([]);
const countryQuery = ref('');
const selectedCountryObj = ref(null);
const showDropdown = ref(false);
const deploying = ref(false);
const lastUpdated = ref('');

// Notification state
const notification = ref({ message: '', type: 'success' });

const fetchStatus = async () => {
  try {
    const res = await axios.get('/admin/status');
    Object.keys(res.data || {}).forEach(key => {
      if (services.value[key]) {
        services.value[key] = res.data[key];
      }
    });
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Status fetch failed', err);
  }
};

const fetchCountries = async () => {
  try {
    const res = await axios.get('/admin/countries');
    countryList.value = Object.values(res.data || {});
    filteredList.value = countryList.value;
  } catch (err) {
    console.error('Countries fetch failed', err);
  }
};

const filteredList = computed(() => {
  const q = countryQuery.value.toLowerCase();
  if (!q.length) return countryList.value;

  return countryList.value.filter(c => c.name.toLowerCase().includes(q));
});

const selectCountry = (ctr) => {
  selectedCountryObj.value = ctr;
  countryQuery.value = ctr.name;
  showDropdown.value = false;
};

const deploy = async () => {
  if (!selectedCountryObj.value) return;

  deploying.value = true;
  notification.value = { message: '', type: 'success' };

  try {
    await axios.post('/admin/deploy', { country: selectedCountryObj.value });
    notification.value = { message: `Deployment started for ${selectedCountryObj.value.name}`, type: 'success' };
  } catch (err) {
    console.error('Deploy failed', err);
    notification.value = { message: 'Deployment failed', type: 'error' };
  } finally {
    deploying.value = false;
    setTimeout(() => {
      notification.value = { message: '', type: 'success' };
    }, 5000); // auto hide after 5s
  }
};

onMounted(() => {
  fetchCountries();
  fetchStatus();
  setInterval(fetchStatus, 5000);
});
</script>
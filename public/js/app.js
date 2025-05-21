import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query,
  where, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyXAKAzI1bPfGhseL6jGqDkdVl9MzbL0RwU",
  authDomain: "agendamento-multi.firebaseapp.com",
  projectId: "agendamento-multi",
  storageBucket: "agendamento-multi.appspot.com",
  messagingSenderId: "867949922180",
  appId: "1:867949922180:web:d8ea3f0132fc97d3977fd1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventosRef = collection(db, "eventos");

let calendar;

document.addEventListener("DOMContentLoaded", async () => {
  initCalendar();
  handleThemeToggle();
  handleSidebarToggle();
  handleMostrarFormulario();
  handleEventSubmit();
});

function initCalendar() {
  const calendarEl = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "pt-br",
    themeSystem: 'bootstrap5',
    height: '100%',
    expandRows: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,timelineMonth'
    },
    views: {
      listWeek: { buttonText: 'Lista' },
      timelineMonth: {
        type: 'timeline',
        duration: { months: 1 },
        buttonText: 'Timeline'
      }
    },
    navLinks: true,
    nowIndicator: true,
    selectable: true,
    dayMaxEvents: true,
    dateClick: async (info) => {
      document.getElementById("dataSelecionada").value = info.dateStr;
      document.querySelector(".modal-title").textContent = `Eventos em ${info.dateStr}`;
      await carregarEventos(info.dateStr);
      document.getElementById("formNovoEvento").classList.add("d-none");
      new bootstrap.Modal(document.getElementById("modalEventos")).show();
    },
    events: async (_, successCallback) => {
      const snapshot = await getDocs(eventosRef);
      const eventos = snapshot.docs.map(doc => {
        const ev = doc.data();
        const nomeEmail = ev.email?.split("@")[0] || "Usuário";
        return {
          title: nomeEmail,
          start: `${ev.data}T${ev.horaInicio}`,
          end: `${ev.data}T${ev.horaFim}`,
          color: "red",
          id: doc.id
        };
      });
      successCallback(eventos);
    }
  });

  calendar.setOption('height', 800);
  calendar.render();
  calendar.updateSize();
}

async function carregarEventos(data) {
  const q = query(eventosRef, where("data", "==", data));
  const snapshot = await getDocs(q);
  const lista = document.getElementById("listaEventos");
  lista.innerHTML = "";

  if (snapshot.empty) {
    lista.innerHTML = '<li class="list-group-item text-muted">Nenhum evento agendado.</li>';
    return;
  }

  snapshot.forEach(docSnap => {
    const ev = docSnap.data();

    const card = document.createElement("div");
    card.className = "card shadow-sm mb-3 border-start border-2 border-danger";

    card.innerHTML = `
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h5 class="card-title mb-1"><i class="bi bi-person-circle me-2"></i>${ev.responsavel}</h5>
          <p class="card-subtitle text-muted small mb-2"><i class="bi bi-envelope-fill me-1"></i> ${ev.email || "—"}</p>
          <p class="mb-1"><i class="bi bi-building me-2"></i><strong>Setor:</strong> ${ev.setor}</p>
          <p class="mb-1"><i class="bi bi-clock me-2"></i><strong>Início:</strong> ${ev.horaInicio} | <strong>Fim:</strong> ${ev.horaFim}</p>
        </div>
        <div class="text-end">
          <button class="btn btn-outline-danger btn-sm" data-id="${docSnap.id}" title="Excluir evento">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </div>
    </div>
  `;

    card.querySelector("button").addEventListener("click", () => excluirEvento(docSnap.id, data));
    lista.appendChild(card);
  });
}

function handleMostrarFormulario() {
  const btn = document.getElementById("btnMostrarFormulario");
  const form = document.getElementById("formNovoEvento");
  btn.addEventListener("click", () => {
    form.classList.toggle("d-none");
  });
}


// agendamento - envio de e-mail

import emailjs from 'https://esm.sh/@emailjs/browser';

// Inicializa o EmailJS
emailjs.init('S5z-uscLRW-2O_geS');

// Função principal de envio
function handleEventSubmit() {
  document.getElementById("formNovoEvento").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = document.getElementById("dataSelecionada").value;
    const responsavel = document.getElementById("inputResponsavel").value.trim();
    const setor = document.getElementById("inputSetor").value;
    const horaInicio = document.getElementById("inputHoraInicio").value;
    const horaFim = document.getElementById("inputHoraFim").value;
    const email = document.getElementById("inputEmail").value.trim();
    const cc_email = document.getElementById("inputCC").value.trim();

    if (!responsavel || !setor || !horaInicio || !horaFim || !email) {
      Swal.fire("Campos obrigatórios", "Por favor, preencha todos os campos.", "warning");
      return;
    }

    if (horaFim <= horaInicio) {
      Swal.fire("Horário inválido", "O horário final deve ser após o horário inicial.", "warning");
      return;
    }

    const q = query(eventosRef, where("data", "==", data));
    const snapshot = await getDocs(q);

    const novoInicio = new Date(`${data}T${horaInicio}`);
    const novoFim = new Date(`${data}T${horaFim}`);

    let conflito = false;

    snapshot.forEach(docSnap => {
      const ev = docSnap.data();
      const evInicio = new Date(`${ev.data}T${ev.horaInicio}`);
      const evFim = new Date(`${ev.data}T${ev.horaFim}`);
      if ((novoInicio < evFim) && (novoFim > evInicio)) {
        conflito = true;
      }
    });

    if (conflito) {
      Swal.fire("Conflito!", "Já existe um evento nesse intervalo de horário.", "warning");
      return;
    }

    try {
      // Salva o evento no Firestore
      await addDoc(eventosRef, {
        data,
        responsavel,
        setor,
        horaInicio,
        horaFim,
        email
      });

      document.getElementById("formNovoEvento").reset();
      document.getElementById("formNovoEvento").classList.add("d-none");

      await carregarEventos(data);
      calendar.refetchEvents();

      Swal.fire("Salvo!", "Evento criado com sucesso.", "success");

      // Envio do e-mail somente após salvar com sucesso
      const dados = {
        responsavel,
        to_email: email,
        cc_email,
        setor,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        data
      };

      emailjs.send("service_7lx5f7d", "template_386x3tr", dados, "S5z-uscLRW-2O_geS")
        .then(function (response) {
          console.log("E-mail enviado com sucesso!", response.status, response.text);
        }, function (error) {
          console.error("Erro ao enviar e-mail:", error);
        });

    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      Swal.fire("Erro!", "Não foi possível salvar o evento.", "error");
    }
  });
}

// excluir 

async function excluirEvento(id, data) {
  const resultado = await Swal.fire({
    title: "Tem certeza?",
    text: "Você não poderá reverter isso!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Sim, excluir!",
    cancelButtonText: "Cancelar"
  });

  if (resultado.isConfirmed) {
    try {
      await deleteDoc(doc(db, "eventos", id));
      await carregarEventos(data);
      calendar.refetchEvents();

      Swal.fire("Excluído!", "O evento foi excluído com sucesso.", "success");
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
      Swal.fire("Erro!", "Não foi possível excluir o evento.", "error");
    }
  }
}


// === Alternar Tema Claro/Escuro ===
function handleThemeToggle() {
  const toggleBtn = document.getElementById("toggleTheme");
  const icon = toggleBtn.querySelector("i");

  // Aplica o tema salvo ao carregar a página
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    icon.classList.remove("bi-moon-fill");
    icon.classList.add("bi-sun-fill");
  } else {
    document.body.classList.remove("dark-mode");
    icon.classList.remove("bi-sun-fill");
    icon.classList.add("bi-moon-fill");
  }

  toggleBtn.addEventListener("click", () => {
    document.body.classList.add("theme-transition");
    document.body.classList.toggle("dark-mode");

    const isDarkMode = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");

    icon.classList.toggle("bi-moon-fill");
    icon.classList.toggle("bi-sun-fill");

    setTimeout(() => {
      document.body.classList.remove("theme-transition");
    }, 800);
  });
}


// === Alternar Sidebar ===
function handleSidebarToggle() {
  const btnToggle = document.getElementById("btnToggleSidebar");
  const sidebar = document.getElementById("sidebar");

  btnToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}


// Controle do botão Setores
const appsCollapse = document.getElementById('appsCollapse');
const iconApps = document.getElementById('iconeApps'); // ID correto

const bsApps = new bootstrap.Collapse(appsCollapse, { toggle: false });

appsCollapse.addEventListener('show.bs.collapse', () => {
  iconApps.classList.remove('bi-chevron-down');
  iconApps.classList.add('bi-chevron-up');
  iconApps.style.transition = 'transform 0.3s ease';
  iconApps.style.transform = 'rotate(360deg)';
});

appsCollapse.addEventListener('hide.bs.collapse', () => {
  iconApps.classList.remove('bi-chevron-up');
  iconApps.classList.add('bi-chevron-down');
  iconApps.style.transition = 'transform 0.3s ease';
  iconApps.style.transform = 'rotate(0deg)';
});

document.getElementById('appsSetores').addEventListener('click', () => {
  bsApps.toggle();
});

// data e hora atual
function atualizarDataHoraEProgresso() {
  const now = new Date();

  // Data formatada
  const opcoesData = { weekday: 'long', day: 'numeric', month: 'long' };
  const dataFormatada = now.toLocaleDateString('pt-BR', opcoesData);
  document.getElementById('currentDate').textContent = dataFormatada;

  // Hora formatada
  const hora = now.getHours().toString().padStart(2, '0');
  const minuto = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('currentTime').textContent = `${hora}:${minuto}`;
}

// Atualizar a cada segundo
setInterval(atualizarDataHoraEProgresso, 1000);
atualizarDataHoraEProgresso();


const latitude = -22.9519;
const longitude = -46.5419;
const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=America%2FSao_Paulo`;

function atualizarClima() {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const temp = Math.round(data.current_weather.temperature);
      const windspeed = data.current_weather.windspeed;
      const weathercode = data.current_weather.weathercode;
      const horaAtual = new Date(data.current_weather.time).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const descricao = mapearCodigoClima(weathercode);

      document.getElementById("weatherIcon").textContent = obterEmojiClima(weathercode);
      document.getElementById("weatherTemp").textContent = `${temp}°C`;
      document.getElementById("weatherDesc").textContent = descricao;
      document.getElementById("weatherTime").textContent = `Atualizado às ${horaAtual}`;
    })
    .catch(err => {
      document.getElementById("weatherDesc").textContent = "Erro ao carregar clima";
    });
}

function mapearCodigoClima(codigo) {
  const descricoes = {
    0: "Céu limpo",
    1: "Principalmente claro",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Névoa",
    48: "Névoa com gelo",
    51: "Chuvisco leve",
    53: "Chuvisco moderado",
    55: "Chuvisco denso",
    61: "Chuva leve",
    63: "Chuva moderada",
    65: "Chuva intensa",
    80: "Aguaceiros leves",
    81: "Aguaceiros moderados",
    82: "Aguaceiros violentos"
  };
  return descricoes[codigo] || "Condição desconhecida";
}

function obterEmojiClima(codigo) {
  const emojis = {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    45: "🌫️",
    48: "🌫️",
    51: "🌦️",
    53: "🌧️",
    55: "🌧️",
    61: "🌦️",
    63: "🌧️",
    65: "🌧️",
    80: "🌦️",
    81: "🌧️",
    82: "⛈️"
  };
  return emojis[codigo] || "❓";
}

function atualizarDataHora() {
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });

  document.getElementById("currentDate").textContent = data;
  document.getElementById("currentTime").textContent = hora;
}

// Iniciar ao carregar a página
window.addEventListener("DOMContentLoaded", () => {
  atualizarClima();
  atualizarDataHora();
  setInterval(atualizarDataHora, 60000);
  setInterval(atualizarClima, 10 * 60 * 1000);
});



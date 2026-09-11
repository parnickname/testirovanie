// Простой трекер задач.
// Бэкенд на стандартной библиотеке Go (без внешних зависимостей),
// хранит задачи в памяти процесса и отдаёт статический фронтенд
// из встроенной (go:embed) папки frontend.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed frontend
var frontendFiles embed.FS

// Task — одна задача трекера.
type Task struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Priority  string `json:"priority"` // low | medium | high
	Done      bool   `json:"done"`
	CreatedAt string `json:"createdAt"`
}

var (
	mu     sync.Mutex
	tasks  []Task
	nextID = 1
)

func main() {
	seed()

	sub, err := fs.Sub(frontendFiles, "frontend")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/tasks", tasksHandler)
	mux.HandleFunc("/api/tasks/", taskHandler)
	mux.Handle("/", http.FileServer(http.FS(sub)))

	addr := ":8080"
	log.Printf("Сервер запущен: http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// seed заполняет список парой стартовых задач, чтобы после запуска
// список не был пустым.
func seed() {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now().Format(time.RFC3339)
	tasks = append(tasks,
		Task{ID: nextID, Title: "Изучить метод чёрного ящика", Priority: "high", Done: false, CreatedAt: now},
	)
	nextID++
	tasks = append(tasks,
		Task{ID: nextID, Title: "Подготовить окружение для тестирования", Priority: "medium", Done: true, CreatedAt: now},
	)
	nextID++
	tasks = append(tasks,
		Task{ID: nextID, Title: "Написать тест-кейсы", Priority: "low", Done: false, CreatedAt: now},
	)
	nextID++
}

// tasksHandler обрабатывает /api/tasks (список и создание).
func tasksHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		defer mu.Unlock()
		writeJSON(w, http.StatusOK, tasks)

	case http.MethodPost:
		var in struct {
			Title    string `json:"title"`
			Priority string `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "некорректный JSON", http.StatusBadRequest)
			return
		}

		mu.Lock()
		t := Task{
			ID:        nextID,
			Title:     in.Title,
			Priority:  in.Priority,
			Done:      false,
			CreatedAt: time.Now().Format(time.RFC3339),
		}
		nextID++
		tasks = append(tasks, t)
		mu.Unlock()

		writeJSON(w, http.StatusCreated, t)

	default:
		http.Error(w, "метод не поддерживается", http.StatusMethodNotAllowed)
	}
}

// taskHandler обрабатывает /api/tasks/{id} (обновление и удаление).
func taskHandler(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "некорректный идентификатор задачи", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodPut:
		var in struct {
			Title    string `json:"title"`
			Priority string `json:"priority"`
			Done     bool   `json:"done"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "некорректный JSON", http.StatusBadRequest)
			return
		}

		mu.Lock()
		defer mu.Unlock()
		for i := range tasks {
			if tasks[i].ID == id {
				tasks[i].Title = in.Title
				tasks[i].Priority = in.Priority
				tasks[i].Done = in.Done
				writeJSON(w, http.StatusOK, tasks[i])
				return
			}
		}
		http.Error(w, "задача не найдена", http.StatusNotFound)

	case http.MethodDelete:
		mu.Lock()
		defer mu.Unlock()
		for i := range tasks {
			if tasks[i].ID == id {
				tasks = append(tasks[:i], tasks[i+1:]...)
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		http.Error(w, "задача не найдена", http.StatusNotFound)

	default:
		http.Error(w, "метод не поддерживается", http.StatusMethodNotAllowed)
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

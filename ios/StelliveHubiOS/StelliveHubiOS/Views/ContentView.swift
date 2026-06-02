import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("홈", systemImage: "house") }
            LiveView()
                .tabItem { Label("라이브", systemImage: "dot.radiowaves.left.and.right") }
            HistoryView()
                .tabItem { Label("기록", systemImage: "clock") }
            SettingsView()
                .tabItem { Label("설정", systemImage: "slider.horizontal.3") }
        }
    }
}


//
//  compassApp.swift
//  compass
//
//  Created by Michael Yu on 2/15/25.
//

import SwiftUI

@main
struct compassApp: App {
    init () {
        UIApplication.shared.isIdleTimerDisabled = true
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { DialogOutletComponent, SnackbarOutletComponent } from "@pos/core-ui";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, DialogOutletComponent, SnackbarOutletComponent],
  template: `
    <router-outlet />
    <lib-dialog-outlet />
    <lib-snackbar-outlet />
  `,
  styles: [],
})
export class App {}

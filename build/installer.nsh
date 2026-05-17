; Кастомный хук NSIS для CloudChef Print Agent.
; customInit выполняется в самом начале установки (до проверки "приложение запущено").
; Принудительно завершаем запущенный агент, чтобы обновление со старых версий
; не упиралось в диалог "CloudChef Print Agent cannot be closed".
;
; ВАЖНО: без флага /T — при авто-обновлении установщик является дочерним
; процессом агента, и /T убил бы сам установщик. taskkill /IM завершает все
; процессы с этим именем (главный + дочерние процессы Electron), не трогая установщик.

!macro customInit
  nsExec::Exec 'taskkill /F /IM "CloudChef Print Agent.exe"'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "Print Agent.exe"'
  Pop $0
!macroend

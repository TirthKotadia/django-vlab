from django.shortcuts import render

def aim(request):
    return render(request, 'experiment/aim.html')

def theory(request):
    return render(request, 'experiment/theory.html')

def procedure(request):
    return render(request, 'experiment/procedure.html')

def pretest(request):
    return render(request, 'experiment/pretest.html')

def simulation(request):
    return render(request, 'experiment/simulation.html')

def posttest(request):
    return render(request, 'experiment/posttest.html')

def references(request):
    return render(request, 'experiment/references.html')

def contributors(request):
    return render(request, 'experiment/contributors.html')

def feedback(request):
    return render(request, 'experiment/feedback.html')
